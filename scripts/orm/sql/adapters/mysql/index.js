'use strict';

var Promise = require('bluebird'),
  inherits = require('inherits'),
  AbstractSQL = require('../../common');

// In my tests of inserting 10,000 records, mysql2 consistently performs faster at around 2 secs
// var mysql = require('mysql');
var mysql = require('mysql2');

var SQL = function () {};

inherits(SQL, AbstractSQL);

SQL.prototype.connectAndUse = function (db, host, username, password, port) {
  var self = this;
  self._con = mysql.createConnection({ // not async!
    host: host,
    user: username,
    password: password
  });
  self._config(db, host, username, password, port);
  var connect = Promise.promisify(self._con.connect, self._con);
  self._query = Promise.promisify(self._con.query, self._con);
  return connect().then(function () {
    db = self.escape(db);
    return self.query('CREATE DATABASE IF NOT EXISTS ' + db +
      ' DEFAULT CHARACTER SET utf8 DEFAULT COLLATE utf8_unicode_ci').then(function () {
      return self.query('USE ' + db);
    });
  });
};

// Finalize schema format, e.g.
// {
//   id: { type: 'primary' },
//   doc_id: { type: 'key' },
//   user_id: { type: 'key', default: 'null' },
//   name: { type: 'varchar', length: 10 },
//   value: { type: 'text' },
//   destroyed_at: { type: 'datetime', default: 'currenttimestamp' },
//   updated_at: { type: 'timestamp' },
//   uuid: { type: 'varbinary', length: 36 },
//   status: { type: 'enum', values: ['Enabled', 'Disabled'] }
// }
// SQL.prototype.createTable = function (table, schema) {

// };

// Must return obj with rows property
SQL.prototype.query = function (sql, replacements) {
  return this._query(sql, replacements);
};

SQL.prototype.close = function () {
  var end = Promise.promisify(this._con.end, this._con);
  return end();
};

SQL.prototype.deleteAndCloseDatabase = function () {
  var self = this;
  return self.query('DROP DATABASE ' + self.escape(self._db)).then(function () {
    return self.close();
  });
};

module.exports = SQL;