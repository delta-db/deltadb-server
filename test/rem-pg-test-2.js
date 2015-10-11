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

// Connection.prototype.failure = function () {
//   console.log('failure');
// var self = this;
//   return this._query('SELECT "THISCAUSESANERROR"').catch(function (err) {
// self._done();
//     // Ignore error
//   });
// };

Connection.prototype.success = function () {
  console.log('success');
  return this._query('SELECT "THIS IS OK"');
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
//    return conn1.failure();
  }).then(function () {
//    return conn2.failure();
  }).then(function () {
    return conn1.success();
  }).then(function () {
    return conn2.success();
  }).then(function () {
    return conn1.disconnect();
  }).then(function () {
    return conn2.disconnect();
  });
};

race();
