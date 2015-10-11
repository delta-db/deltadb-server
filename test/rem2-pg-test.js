var pg = require('pg'), promise = require('bluebird');

var conString = "postgres://postgres:secret@localhost/postgres";

var i = 0;

var Connection = function () {};

Connection.prototype.connect = function () {
  var self = this;
  return new Promise(function (resolve, reject) {
    // get a pg client from the connection pool
    pg.connect(conString, function(err, client, done) {
      console.log('connected to pgtest');

      if (err) {
        reject(err);
      } else {
        // An error occurred, remove the client from the connection pool.
        // A truthy value passed to done will remove the connection from the pool
        // instead of simply returning it to be reused.
        // In this case, if we have successfully received a client (truthy)
        // then it will be removed from the pool.
        // if(client){
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

Connection.prototype.create = function () {
  console.log('creating pgtest');
  return this._query('CREATE DATABASE pgtest').catch(function (err) {
    // Ignore race conditions when creating dbs
    if (err.message !== 'database "pgtest" already exists') {
      throw err;
    }
  });
};

Connection.prototype.drop = function () {
  console.log('dropping pgtest');
  return this._query('DROP DATABASE pgtest');
};

Connection.prototype.disconnect = function () {
  console.log('disconnecting');
  this._client.end(); // async
  return Promise.resolve();
};

// -----

var race = function () {
  var conn1 = new Connection(), conn2 = new Connection();
  return conn1.connect().then(function () {
    return conn2.connect();
  }).then(function () {
    return conn1.create();
  }).then(function () {
    return conn2.create();
  }).then(function () {
    return conn1.drop();
  }).then(function () {
    return conn2.drop();
  }).then(function () {
    return conn1.disconnect();
  }).then(function () {
    return conn2.disconnect();
  });
};

race();
