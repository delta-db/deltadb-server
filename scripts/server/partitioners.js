'use strict';

// TODO: separate polling code into different model?

var Promise = require('bluebird'),
  Partitioner = require('../partitioner/sql');

var Partitioners = function () {
  this._partitioners = {};
};

Partitioners.POLL_SLEEP_MS = 1000;

Partitioners.prototype.register = function (dbName, socket) {
  if (this._partitioners[dbName]) { // exists?
    this._partitioners[dbName].conns[socket.conn.id] = { socket: socket, since: null };
    return Promise.resolve(this._partitioners[dbName]['part']);
  } else {
    // First conn for this partitioner
    var part = new Partitioner(dbName), ids = {};
    conns[socket.conn.id] = { socket: socket, since: null }
    this._partitioners[dbName] = {
      part: part,
      conns: conns,
      poll: true,
      since: null
    };
    var self = this;
    return part.connect().then(function () {
      self._poll(part);
      retun part;
    });
  }
};

Partitioners.prototype.unregister = function (dbName, socket) {
  // Remove the connection
  delete this._partitioners[dbName].conns[socket.conn.id];

  // Delete partitioner if no more connections for this partition
  if (this._partitioners[dbName].conns.length === 0) {
    // This needs to be kept here and not nested in another fn so that the process of removing the
    // socket and stopping the polling is atomic
    this._partitioners[dbName].poll = false; // stop polling

    var part = this._partitioners[dbName];
    
    // Delete before closing as the close is a promise and we don't want another cycle to use a
    // partitioner that is being closed.
    delete this._partitioners[dbName];
    return part.closeDatabase();
  } else {
    return Promise.resolve();
  }
};

Partitioners.prototype._shouldPoll = function (partitioner) {
  return this._partitioners[partitioner._dbName].poll;
};

Partitioners.prototype._notifyAllPartitionerConnections = function (partitioner, newSince) {
  var self = this;

  // Loop through all associated conns and notify that sync is needed
  self.partitioners[partitioner._dbName].conns.forEach(function (conn) {
    conn.socket.emit('sync-needed');
  });
  
  self.partitioners[partitioner._dbName].since = newSince; // update since
};

// TODO: how does server determine when to look for changes? In future, would be nice if this code
// could be alerted via an event when there is a new change. For now, we'll just implement a polling
// mechanism. Is something better really needed?
Partitioners.prototype._doPoll = function (partitioner) {
  var self = this,
    newSince = new Date(); // save timestamp before to prevent race condition

  // Check for changes
  return self._hasChanges(partitioner, self.partitioners[partitioner._dbName].since)
    .then(function (has) {
      if (has) {
        return self._notifyAllPartitionerConnections(partitioner, newSince);
      }
    });
};

Partitioners.prototype._hasChanges = function (partitioner, since) {
  // TODO: refactor partitioner so that you can just check for changes instead of actually getting
  // the changes?
  return partitioner.changes(since, null, 1).then(function (changes) {
    return changes.length > 0;
  });
};

Partitioners.prototype._poll = function (partitioner) {
  var self = this;
  if (self._shouldPoll(partitioner)) {
    self._poll(partitioner).then(function () {
      setTimeout(function () {
        self._poll(partitioner);
      }, Partitioners.POLL_SLEEP_MS);
      self._beginPolling(partitioner);
    });
  }
};

module.exports = Partitioners;