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

// TODO: what happens when this loops? Is that even something to worry about in a lifetime?
Connections.prototype._nextId = function () {
  return this._id++;
};

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

console.log('##########################################');
console.log('Connections.prototype.connect, db=', db, 'id=', id, 'ids=', self._connections[connString].ids);
console.log('##########################################');

  return self._connections[connString].connection.connect().then(function () {
    return Promise.resolve({ connection: self._connections[connString].connection, id: id });
  }).catch(function (err) {
    return self._unregister(id, db, host, username, password, port).then(function () {
      throw err;
    });
  });
};

Connections.prototype._unregisterAll = function (db, host, username, password, port) {
  var connString = this._connString(db, host, username, password, port);
console.log('Connections.prototype._unregisterAll, db=', db);
  var conn = this._connections[connString];
  delete this._connections[connString];
  return Promise.resolve(conn);
};

Connections.prototype._unregister = function (id, db, host, username, password, port) {
  var connString = this._connString(db, host, username, password, port);
console.log('Connections.prototype._unregister, db=', db, 'id=', id, 'ids=', this._connections[connString].ids);
  delete this._connections[connString].ids[id];
  if (utils.empty(this._connections[connString].ids)) { // last connection?
    return this._unregisterAll(db, host, username, password, port);
// var conn = this._connections[connString];
// delete this._connections[connString];
// return Promise.resolve(conn);
  } else { // remove id as still being used by others
    return Promise.resolve();
  }
};

Connections.prototype.disconnect = function (id, db, host, username, password, port) {
console.log('Connections.prototype.disconnect1, db=', db);
  return this._unregister(id, db, host, username, password, port).then(function (conn) {
console.log('Connections.prototype.disconnect2, db=', db);
    if (conn) {
console.log('Connections.prototype.disconnect3, db=', db);
      return conn.connection.disconnect();
    }
  });
};

Connections.prototype.disconnectAll = function (db, host, username, password, port) {
  return this._unregisterAll(db, host, username, password, port).then(function (conn) {
console.log('Connections.prototype.disconnectAll, db=', db);
    if (conn) { // is there a connection to close?
      return conn.connection.disconnect();
    }
  });
};

module.exports = new Connections();
