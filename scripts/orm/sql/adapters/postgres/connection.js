'use strict';

var pg = require('pg'),
  Promise = require('bluebird'),
  SocketClosedError = require('../../common/socket-closed-error'),
  inherits = require('inherits'),
  EventEmitter = require('events').EventEmitter;

var Connection = function (connString) {
  EventEmitter.apply(this, arguments); // apply parent constructor
  this._connString = connString;
  this._connected = false;
  this._connecting = null;
};

inherits(Connection, EventEmitter);

Connection.prototype._connect = function () {
  var self = this;
  return new Promise(function (resolve, reject) {
    // get a pg client from the connection pool
    pg.connect(self._connString, function(err, client, done) {
      if (err) {
        self._connecting = null;
        reject(err);
      } else {
        // An error occurred, remove the client from the connection pool. A truthy value passed to
        // done will remove the connection from the pool instead of simply returning it to be
        // reused. In this case, if we have successfully received a client (truthy) then it will be
        // removed from the pool.
        // if (client){
        //   done(client);
        // }

        self._client = client;
        self._done = done;
        self._connected = true;
        resolve();
      }
    });
  });
};

// TODO: this could be enhanced so that back-to-back connection requests are queued and then
// processed
Connection.prototype.connect = function () {
  if (this._connected) {
    return Promise.resolve();
  } else {
    if (!this._connecting) {
      this._connecting = this._connect();
    }
    return this._connecting;
  }
};

Connection.prototype._ready = function () {
  if (this._connected || !this._connecting) {
    return Promise.resolve();
  } else {
    return this._connecting;
  }
};

Connection.prototype._query = function (sql, replacements) {
  var self = this;
  return new Promise(function (resolve, reject) {
    if (!self._connected) {
      // self._client.query doesn't always throw an error if the connection was closed
      self._close();
      reject(new SocketClosedError('socket was closed'));
    }

    self._client.query(sql, replacements, function(err, result) {
      if (err) {
        if (err.code === 'EPIPE' || err.message === 'This socket is closed.' ||
          err.message === 'This socket has been ended by the other party' ||
          err.message === 'terminating connection due to administrator command') {
          self._close();
          reject(new SocketClosedError(err.message));
        } else {
          reject(err);
        }
      } else {
        resolve(result);
      }
    });
  });
};

Connection.prototype._close = function () {
  this._client.end(); // async
  this._connected = false;
  this.emit('disconnect');
};

Connection.prototype.query = function (sql, replacements) {
  var self = this;
  return self._ready().then(function () { // don't execute query until connected
    return self._query(sql, replacements);
  });
};

Connection.prototype.disconnect = function () {
  var self = this;
  return self._ready().then(function () { // don't end until connected
    self._close();
  });
};

module.exports = Connection;
