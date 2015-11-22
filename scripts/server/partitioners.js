'use strict';

// TODO: separate polling code into different model?

var Promise = require('bluebird'),
  Partitioner = require('../partitioner/sql'),
  log = require('../server/log'),
  utils = require('../utils'),
  clientUtils = require('../client/utils'),
  SocketClosedError = require('../orm/sql/common/socket-closed-error'),
  DBMissingError = require('../client/db-missing-error'),
  Dictionary = require('../utils/dictionary'),
  Users = require('../partitioner/sql/user/users'),
  Changes = require('../partitioner/sql/changes');

var Partitioners = function () {
  this._partitioners = {};
  this._systemPartitioner = new Partitioner(clientUtils.SYSTEM_DB_NAME);
};

Partitioners.prototype.dbExists = function (dbName) {
  return this._systemPartitioner.dbExists(dbName).then(function (exists) {
    if (!exists) {
      throw new DBMissingError(dbName + ' missing');
    }
  });
};

/**
 * Milliseconds to sleep between polls for data. In the future we won't need this as we'll receive
 * an event when there is new data.
 */
Partitioners.POLL_SLEEP_MS = 500;

Partitioners.prototype.existsThenRegister = function (dbName, socket, since, filter, userUUID,
  userId) {
  var self = this;
  return self.dbExists(dbName).then(function () {
    return self.register(dbName, socket, since, filter, userUUID, userId);
  });
};

Partitioners.prototype._defaultFilters = function () {
  return {
    docs: {},
    // roleUsers: {},
    userRoles: new Dictionary()
  };
};

Partitioners.prototype._setContainer = function (dbName, socket, container) {
  // Has a competing registration already set the dbName?
  if (this._partitioners[dbName]) {
    // Add connection
    this._partitioners[dbName].conns[socket.conn.id] = container.conns[socket.conn.id];
  } else {
    this._partitioners[dbName] = container;
    this._poll(container.part);
  }
};

// TODO: split up
Partitioners.prototype.register = function (dbName, socket, since, filter, userUUID, userId) {
  var self = this;
  if (self._partitioners[dbName]) { // exists?
    self._partitioners[dbName].conns[socket.conn.id] = {
      socket: socket,
      since: since,
      filters: self._defaultFilters(),
      filter: filter,
      userUUID: userUUID,
      userId: userId
    };
    return self._partitioners[dbName].ready;
  } else {

    // First conn for this partitioner
    var part = new Partitioner(dbName),
      conns = {};

    conns[socket.conn.id] = {
      socket: socket,
      since: since,
      filters: self._defaultFilters(),
      filter: filter,
      userUUID: userUUID,
      userId: userId
    };

    var container = {
      part: part,
      conns: conns,
      poll: true,
      since: null
    };

    // Save promise so that any registrations for the same partitioner that happen back-to-back can
    // wait until the partitioner is ready
    container.ready = part.connect().then(function () {
      self._setContainer(dbName, socket, container);
      return part;
    });

    return container.ready;
  }
};

Partitioners.prototype._unregisterPartitioner = function (dbName) {
  // This needs to be kept here and not nested in another fn so that the process of removing the
  // socket and stopping the polling is atomic
  this._partitioners[dbName].poll = false; // stop polling

  var part = this._partitioners[dbName].part;

  // Delete before closing as the close is a promise and we don't want another cycle to use a
  // partitioner that is being closed.
  delete this._partitioners[dbName];

  return part.closeDatabase().then(function () {
    log.info('closed ' + dbName);
  });
};

Partitioners.prototype.unregister = function (dbName, socket) {
  // Remove the connection

  // Guard against race conditions
  if (!this._partitioners[dbName]) {
    return Promise.resolve();
  }

  delete this._partitioners[dbName].conns[socket.conn.id];

  // Delete partitioner if no more connections for this partition
  if (utils.empty(this._partitioners[dbName].conns)) {
    return this._unregisterPartitioner(dbName);
  } else {
    return Promise.resolve();
  }
};

Partitioners.prototype._shouldPoll = function (partitioner) {
  return this._partitioners[partitioner._dbName] && this._partitioners[partitioner._dbName].poll;
};

Partitioners.prototype._notifyAllPartitionerConnections = function (partitioner, newSince) {
  var self = this;

  // Loop through all associated conns and notify that sync is needed
  utils.each(self._partitioners[partitioner._dbName].conns, function (conn) {
    self.findAndEmitChanges(partitioner._dbName, conn.socket);
  });

  self._partitioners[partitioner._dbName].since = newSince; // update since
};

// TODO: how does server determine when to look for changes? In future, would be nice if this code
// could be alerted via an event when there is a new change. For now, we'll just implement a polling
// mechanism. Is something better really needed?
Partitioners.prototype._doPoll = function (partitioner) {
  var self = this,
    newSince = new Date(); // save timestamp before to prevent race condition

  // Check for changes
  return self._hasChanges(partitioner, self._partitioners[partitioner._dbName].since)
    .then(function (has) {
      if (has) {
        return self._notifyAllPartitionerConnections(partitioner, newSince);
      }
    }).catch(function (err) {
      // TODO: create mechanism to gracefully alert poll that a DB has been destroyed so that it
      // doesn't generate unexpected errors due to missing tables, socket connections, etc...
      log.warning('doPoll error=' + err);
    });
};

Partitioners.prototype._hasChanges = function (partitioner, since) {
  // TODO: refactor partitioner so that you can just check for changes instead of actually getting
  // the changes?
  var self = this;
  // var all = partitioner._dbName === clientUtils.SYSTEM_DB_NAME; // TODO: make configurable?
  var all = true;

  // Server needs to use super to check for changes, but then we use the user associated with the
  // connection user when actually getting changes
  return partitioner.changes(since, null, 1, null, all, Users.ID_SUPER).then(function (changes) {
    return changes.length > 0;
  }).catch(function (err) {
    if (err instanceof SocketClosedError) {
      // TODO: why do we randomly get these errors w/ postgres? Is there a better way to handle
      // them, e.g. reconnect?
      self._unregisterPartitioner(partitioner._dbName);
    } else {
      throw err;
    }
  });
};

Partitioners.prototype._poll = function (partitioner) {
  var self = this;
  if (self._shouldPoll(partitioner)) {
    self._doPoll(partitioner).then(function () {
      setTimeout(function () {
        self._poll(partitioner);
      }, Partitioners.POLL_SLEEP_MS);
    });
  }
};

Partitioners.prototype._emitChanges = function (socket, changes, since) {
  var msg = {
    changes: changes,
    since: since
  };
  log.info('sending (to ' + socket.conn.id + ') ' + JSON.stringify(msg));
  socket.emit('changes', msg);
};

Partitioners.prototype._saveFilters = function (dbName, socket, changes) {
  // We only support filters on the system DB for now as we want to make sure that a client doesn't
  // receive all system deltas
  var self = this,
    action = null;
  if (dbName === clientUtils.SYSTEM_DB_NAME &&
    self._partitioners[dbName].conns[socket.conn.id].filter) { // system DB and filtering enabled?

    var filters = self._partitioners[dbName].conns[socket.conn.id].filters; // for convenience

    changes.forEach(function (change) {

      switch (change.name) {

        // case clientUtils.ATTR_NAME_ROLE_USER: // role user?
        //   var action = JSON.parse(change.val);
        //   filters.roleUsers[action.roleName][action.userUUID] = true;
        //   break;

      case clientUtils.ATTR_NAME_ROLE: // role?
        action = JSON.parse(change.val);
        filters.userRoles.set(action.userUUID, action.roleName, true);
        break;

      default:
        filters.docs[change.id] = true;
        break;
      }

    });

  }
};

// TODO: split up
Partitioners.prototype._includeChange = function (dbName, socket, change) {
  // TODO: should we clear the filters after use so that we don't occupy more memory than is needed?

  // Should we filter?
  if (dbName === clientUtils.SYSTEM_DB_NAME &&
    this._partitioners[dbName].conns[socket.conn.id].filter) {

    var filters = this._partitioners[dbName].conns[socket.conn.id].filters; // for convenience

    var val = null;

    switch (change.name) {

    case clientUtils.ATTR_NAME_ROLE: // adding user to role?
      val = JSON.parse(change.val);
      // Role user registered?
      if (filters.userRoles.exists(val.userUUID, val.roleName)) {
        // Set id so that we can filter destroy
        filters.docs[change.id] = true;
        return true;
      }
      return false;

      // case clientUtils.ATTR_NAME_ROLE_USER: // adding user to role?
      //   var val = JSON.parse(change.val);
      //   // Role user registered?
      //   if (filters.roleUsers[val.roleName] && filters.roleUsers[val.roleName][val.userUUID]) {
      //     // Set id so that we can filter destroy
      //     filters.docs[change.id] = true;
      //     return true;
      //   }
      //   return false;

    default: // policy?
      return filters.docs[change.id] ? true :
        false;
    }

  } else {
    return true;
  }
};

Partitioners.prototype._filter = function (dbName, socket, changes) {
  // We only support filters on the system DB for now as we want to make sure that a client doesn't
  // receive all system deltas
  var self = this,
    newChanges = [],
    i = 0;
  if (dbName === clientUtils.SYSTEM_DB_NAME) { // system DB?
    changes.forEach(function (change) {
      if (self._includeChange(dbName, socket, change)) {
        newChanges[i++] = change;
      }
    });
  } else {
    newChanges = changes;
  }

  return newChanges;
};

Partitioners.prototype._userUUID = function (dbName, socket) {
  return this._partitioners[dbName].conns[socket.conn.id].userUUID;
};

Partitioners.prototype._addUserUUID = function (dbName, socket, changes) {
  // This will actually overwrite any ids set by the clients, which is a good safeguard against the
  // client trying to spoof its identity.
  var userUUID = this._userUUID(dbName, socket);
  changes.forEach(function (change) {
    change.uid = userUUID;
  });
};

// TODO: remove dbName parameter as can derive dbName from socket
Partitioners.prototype._queueChanges = function (dbName, socket, msg) {
  log.info('received (from ' + socket.conn.id + ') ' + JSON.stringify(msg));

  var self = this,
    part = self._partitioners[dbName].part;

  self._addUserUUID(dbName, socket, msg.changes);

  self._saveFilters(dbName, socket, msg.changes);

  // TODO: this needs to be a variable, e.g. false if there is only one DB server and true if there
  // is more than 1
  var quorum = true;
  return part.queue(msg.changes, quorum);
};

Partitioners.prototype._changes = function (partitioner, since, limit, offset, userId) {
  // var all = dbName === clientUtils.SYSTEM_DB_NAME; // TODO: make configurable?
  var all = true;
  return partitioner.changes(since, null, limit, offset, all, userId).catch(function (err) {
    // Ignore SocketClosedError as it could have been caused when a db was destroyed
    if (!(err instanceof SocketClosedError)) {
      throw err;
    }
  });
};

Partitioners.prototype._filteredChanges = function (dbName, socket, partitioner, since, limit,
  offset, userId) {
  var self = this;
  return self._changes(partitioner, since, limit, offset, userId).then(function (changes) {
    return self._filter(dbName, socket, changes);
  });
};

Partitioners.prototype._findAndEmitChangesByPage = function (dbName, socket, partitioner, since,
  limit, offset, userId, newSince) {
  var self = this;
  return self._filteredChanges(dbName, socket, partitioner, since, limit, offset, userId).then(
    function (changes) {
      if (changes.length > 0) { // Are there local changes?
        // TODO: should we refactor so that changes = { changes: changes, more: more } instead of
        // using Changes._HAS_MORE?
        if (changes[changes.length - 1] === Changes._HAS_MORE) { // more pages?
          // Not done so don't update since
          self._emitChanges(socket, changes, since);
          offset += limit;
          changes.splice(changes.length - 1, 1); // remove last change
          return self._findAndEmitChangesByPage(dbName, socket, partitioner, since, limit,
            offset,
            userId, newSince);
        } else {
          // Done so update since
          self._emitChanges(socket, changes, newSince);
        }
      }
    });
};

// TODO: remove dbName parameter as can derive dbName from socket
Partitioners.prototype.findAndEmitChanges = function (dbName, socket) {
  var self = this,
    part = self._partitioners[dbName].part,
    since = self._partitioners[dbName].conns[socket.conn.id].since,
    userId = self._partitioners[dbName].conns[socket.conn.id].userId,
    newSince = new Date();

  self._partitioners[dbName].conns[socket.conn.id].since = newSince;

  // var all = dbName === clientUtils.SYSTEM_DB_NAME; // TODO: make configurable?
  var limit = Changes._MAX_LIMIT;
  var offset = 0; // start at beginning
  return self._findAndEmitChangesByPage(dbName, socket, part, since, limit, offset, userId,
    newSince);
};

module.exports = Partitioners;
