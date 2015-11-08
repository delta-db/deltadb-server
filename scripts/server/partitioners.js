'use strict';

// TODO: separate polling code into different model?

var Promise = require('bluebird'),
  Partitioner = require('../partitioner/sql'),
  log = require('../server/log'),
  utils = require('../utils'),
  clientUtils = require('../client/utils'),
  SocketClosedError = require('../orm/sql/common/socket-closed-error'),
  DBMissingError = require('../client/db-missing-error'),
  Doc = require('../client/doc');

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

Partitioners.POLL_SLEEP_MS = 1000;

Partitioners.prototype.existsThenRegister = function (dbName, socket, since, filter) {
  var self = this;
  return self.dbExists(dbName).then(function () {
    return self.register(dbName, socket, since, filter);
  });
};

Partitioners.prototype._defaultFilters = function () {
  return {
    docs: {},
    dbs: {} /*, users: {} */
  };
};

// TODO: split up
Partitioners.prototype.register = function (dbName, socket, since, filter) {
  var self = this;
  if (self._partitioners[dbName]) { // exists?
    self._partitioners[dbName].conns[socket.conn.id] = {
      socket: socket,
      since: since,
      filters: self._defaultFilters(),
      filter: filter
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
      filter: filter
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

      // Has a competing registration already set the dbName?
      if (self._partitioners[dbName]) {
        // Add connection
        self._partitioners[dbName].conns[socket.conn.id] = conns[socket.conn.id];
      } else {
        self._partitioners[dbName] = container;
        self._poll(part);
      }

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
  var self = this,
    all = partitioner._dbName === clientUtils.SYSTEM_DB_NAME; // TODO: make configurable?
  return partitioner.changes(since, null, 1, null, all).then(function (changes) {
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
  var self = this;
  if (dbName === clientUtils.SYSTEM_DB_NAME &&
    self._partitioners[dbName].conns[socket.conn.id].filter) { // system DB and filtering enabled?

    changes.forEach(function (change) {

      switch (change.name) {
        case clientUtils.DB_ATTR_NAME: // db action?
          var action = JSON.parse(change.val);
          self._partitioners[dbName].conns[socket.conn.id].filters.dbs[action.name] = true;
          break;

        default:
          self._partitioners[dbName].conns[socket.conn.id].filters.docs[change.id] = true;
          break;
      }

    });
  }
};

Partitioners.prototype._includeChange = function (dbName, socket, change) {
  // TODO: should we clear the filters after use so that we don't occupy more memory than is needed?

  // Should we filter?
  if (dbName === clientUtils.SYSTEM_DB_NAME &&
    this._partitioners[dbName].conns[socket.conn.id].filter) {

    if (typeof change.val === 'undefined') { // destroying
      if (this._partitioners[dbName].conns[socket.conn.id].filters.docs[change.id]) { // include?
        return true;
      }
    } else { // creating
      switch (change.name) {

      case clientUtils.DB_ATTR_NAME: // db action?
        var val = JSON.parse(change.val);
        // DB name registered?
        if (this._partitioners[dbName].conns[socket.conn.id].filters.dbs[val]) {
          // Set id so that we can filter destroy
          this._partitioners[dbName].conns[socket.conn.id].filters.docs[change.id] = true;
          return true;
        }
        return false;

      default: // policy?
        return this._partitioners[dbName].conns[socket.conn.id].filters.docs[change.id] ? true :
          false;
      }
    }

  } else {
    return true;
  }

  return false;
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

// TODO: remove dbName parameter as can derive dbName from socket
Partitioners.prototype._queueChanges = function (dbName, socket, msg) {
  log.info('received (from ' + socket.conn.id + ') ' + JSON.stringify(msg));

  var self = this,
    part = self._partitioners[dbName].part;

  self._saveFilters(dbName, socket, msg.changes);

  // TODO: this needs to be a variable, e.g. false if there is only one DB server and true if there
  // is more than 1
  var quorum = true;
  return part.queue(msg.changes, quorum);
};

// TODO: remove dbName parameter as can derive dbName from socket
Partitioners.prototype.findAndEmitChanges = function (dbName, socket) {
  var self = this,
    part = self._partitioners[dbName].part,
    since = self._partitioners[dbName].conns[socket.conn.id].since,
    newSince = new Date();

  self._partitioners[dbName].conns[socket.conn.id].since = newSince;

  // TODO: need to support pagination. Need to cap the results with the offset param, but then
  // need to report to client that there is more data and to do another sync, but don't need
  // client to resend changes. On the other side, how do we handle pagination from client?
  var all = dbName === clientUtils.SYSTEM_DB_NAME; // TODO: make configurable?
  return part.changes(since, null, null, null, all).then(function (changes) {
    changes = self._filter(dbName, socket, changes);
    if (changes.length > 0) { // Are there local changes?
      self._emitChanges(socket, changes, newSince);
    }
  }).catch(function (err) {
    // Ignore SocketClosedError as it could have been caused when a db was destroyed
    if (!(err instanceof SocketClosedError)) {
      throw err;
    }
  });
};

module.exports = Partitioners;
