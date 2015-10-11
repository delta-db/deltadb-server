var Promise = require('bluebird'),
  Connection = require('./connection'),
  utils = require('../../../../utils');

/**
 * A construct that allows a single process to share connections between ticks
 */
var Connections = function () {
  this._connections = {};
  this._id = 1;
};

Connections.prototype._connString = function (db, host, username, password, port) {
  return 'postgres://' + username + ':' + password + '@' + host + '/' + db;
};

Connections.prototype._nextId = function () {
  return this._id++;
};

// TODO: how to fix so that subsequent conn requests can succeed if DB then created??
Connections.prototype.connect = function (db, host, username, password, port) {
  var self = this, id = self._nextId(),
    connString = self._connString(db, host, username, password, port);

  if (self._connections[connString]) { // conn exists?
    self._connections[connString].ids[id] = true;
  } else {
    var ids = {};
    ids[id] = true;
    self._connections[connString] = { connection: new Connection(connString), ids: ids };
  }

  return self._connections[connString].connection._connected.then(function () {
    return { connection: self._connections[connString].connection, id: id };
  });
};

Connections.prototype.disconnect = function (id, db, host, username, password, port) {
  var connString = this._connString(db, host, username, password, port);
  delete this._connections[connString].ids[id];
  if (utils.empty(this._connections[connString].ids)) { // last connection?
    var con = this._connections[connString];
    delete this._connections[connString];
    return con.connection.disconnect();
  } else { // remove id as still being used by others
    return Promise.resolve();
  }
};

module.exports = new Connections();
