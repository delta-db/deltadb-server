var pg = require('pg'), promise = require('bluebird');

// var conString = "postgres://postgres:secret@localhost/postgres";

var utils = require('../scripts/utils');

// -----

var Connection = function (connString) {
  this._connected = this._connect(connString);
};

Connection.prototype._connect = function (connString) {
  var self = this;
  return new Promise(function (resolve, reject) {
    // get a pg client from the connection pool
    pg.connect(connString, function(err, client, done) {
      if (err) {
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
        resolve();
      }
    });
  });
};

Connection.prototype._query = function (sql) {
  var self = this;
  return new Promise(function (resolve, reject) {
    self._client.query(sql, function(err, result) {
      if (err) {
        reject(err);
      } else {
        resolve(result);
      }
    });
  });
};

Connection.prototype.query = function (sql) {
  var self = this;
  return self._connected.then(function () { // don't execute query until connected
    return self._query(sql);
  });
};

Connection.prototype.disconnect = function () {
  var self = this;
  return self._connected.then(function () { // don't end until connected
    self._client.end(); // async
  });
};

// -----

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

Connections.prototype.connect = function (db, host, username, password, port) {
  var self = this, id = self._nextId(),
    connString = self._connString(db, host, username, password, port);
  if (!self._connections[connString]) {
    var ids = {};
    ids[id] = true;
    self._connections[connString] = { connection: new Connection(connString), ids: ids };
  } else {
    self._connections[connString].ids[id] = true;
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

var connections = new Connections();

// -----

var ORM = function () {
  this._connection = null;
};

ORM.prototype.connect = function (db, host, username, password, port) {
  console.log('ORM.prototype.connect');
  var self = this;
  return connections.connect(db, host, username, password, port).then(function (connection) {
    self._connection = connection;
  });
};

ORM.prototype.query = function (sql) {
  return this._connection.connection.query(sql);
};

ORM.prototype.success = function () {
  console.log('ORM.prototype.success');
  return this.query('SELECT NOW()');
};

ORM.prototype.disconnect = function (db, host, username, password, port) {
  console.log('ORM.prototype.disconnect');
  return connections.disconnect(this._connection.id, db, host, username, password, port);
};

// -----

var db = 'postgres', host = 'localhost', username = 'postgres', password = 'secret', port = null;

var race = function () {
  var orm1 = new ORM(), orm2 = new ORM();
  return orm1.connect(db, host, username, password, port).then(function () {
    return orm2.connect(db, host, username, password, port);
  }).then(function () {
    return orm1.success();
  }).then(function () {
    return orm2.success();
  }).then(function () {
    return orm1.disconnect(db, host, username, password, port);
  }).then(function () {
    return orm2.disconnect(db, host, username, password, port);
  }).catch(function (err) {
    console.log('err=', err);
  });
};

race();
