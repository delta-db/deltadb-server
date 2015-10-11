var pg = require('pg'),
  Promise = require('bluebird');

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

Connection.prototype._query = function (sql, replacements) {
  var self = this;
  return new Promise(function (resolve, reject) {
    self._client.query(sql, replacements, function(err, result) {
      if (err) {
        reject(err);
      } else {
        resolve(result);
      }
    });
  });
};

Connection.prototype.query = function (sql, replacements) {
  var self = this;
  return self._connected.then(function () { // don't execute query until connected
    return self._query(sql, replacements);
  });
};

Connection.prototype.disconnect = function () {
  var self = this;
  return self._connected.then(function () { // don't end until connected
    self._client.end(); // async
  });
};

module.exports = Connection;
