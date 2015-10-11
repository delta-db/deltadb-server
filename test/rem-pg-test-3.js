var pg = require('pg'), promise = require('bluebird');

var conString = "postgres://postgres:secret@localhost/postgres";

var utils = require('../scripts/utils');

// -----

var Connection = function (/* TODO: db, host, etc... */) {
  this._connected = this._connect();
};

Connection.prototype._connect = function () {
console.log('Connection.prototype._connect1');
  var self = this;
  return new Promise(function (resolve, reject) {
console.log('Connection.prototype._connect2');
    // get a pg client from the connection pool
    pg.connect(conString, function(err, client, done) {
console.log('Connection.prototype._connect3');
      if (err) {
console.log('Connection.prototype._connect4');
        reject(err);
      } else {
console.log('Connection.prototype._connect5');
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
console.log('Connection.prototype._query1');
  var self = this;
  return new Promise(function (resolve, reject) {
console.log('Connection.prototype._query2');
    self._client.query(sql, function(err, result) {
console.log('Connection.prototype._query3');
      if (err) {
console.log('Connection.prototype._query4, err=', err);
        reject(err);
      } else {
console.log('Connection.prototype._query5');
        resolve(result);
      }
    });
  });
};

Connection.prototype.query = function (sql) {
console.log('Connection.prototype.query1');
  var self = this;
console.log('Connection.prototype.query2');
  return self._connected.then(function () { // don't execute query until connected
console.log('Connection.prototype.query3');
    return self._query(sql);

// }).then(function () {
// console.log('Connection.prototype.query4');

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

Connections.prototype._nextId = function () {
  return this._id++;
};

Connections.prototype.connect = function (/* TODO: db, host, etc... */) {
console.log('Connections.prototype.connect1');
  var self = this, id = self._nextId();
console.log('Connections.prototype.connect2');
  if (!self._connections[conString]) {
console.log('Connections.prototype.connect3');
    var ids = {};
    ids[id] = true;
    self._connections[conString] = { connection: new Connection(), ids: ids };
  } else {
console.log('Connections.prototype.connect4');
    self._connections[conString].ids[id] = true;
  }
console.log('Connections.prototype.connect5');
  return self._connections[conString].connection._connected.then(function () {
console.log('Connections.prototype.connect6');
    return { connection: self._connections[conString].connection, id: id };
  });
};

Connections.prototype.disconnect = function (id /* TODO: db, host, etc... */) {
console.log('Connections.prototype.disconnect1, id=', id);
  delete this._connections[conString].ids[id];
  if (utils.empty(this._connections[conString].ids)) { // last connection?
console.log('Connections.prototype.disconnect2');
    var con = this._connections[conString];
    delete this._connections[conString];
    return con.connection.disconnect();
  } else { // remove id as still being used by others
console.log('Connections.prototype.disconnect3');
console.log('ids=', this._connections[conString].ids);
    return Promise.resolve();
  }
};

var connections = new Connections();

// -----

var ORM = function () {
  this._connection = null;
};

ORM.prototype.connect = function () {
  console.log('ORM.prototype.connect');
  var self = this;
  return connections.connect().then(function (connection) {
console.log('ORM.prototype.connect2, connection.id=', connection.id);
    self._connection = connection;
  });
};

ORM.prototype.query = function (sql) {
console.log('ORM.prototype.query');
  return this._connection.connection.query(sql);
};

ORM.prototype.success = function () {
  console.log('ORM.prototype.success');
  return this.query('SELECT NOW()');
};

ORM.prototype.disconnect = function () {
  console.log('ORM.prototype.disconnect');
  return connections.disconnect(this._connection.id);
};

// -----

var race = function () {
  var orm1 = new ORM(), orm2 = new ORM();
  return orm1.connect().then(function () {
    return orm2.connect();
  }).then(function () {
    return orm1.success();
  }).then(function () {
console.log('after 1st success');
    return orm2.success();
  }).then(function () {
    return orm1.disconnect();
  }).then(function () {
    return orm2.disconnect();
  }).catch(function (err) {
    console.log('err=', err);
  });
};

race();
