'use strict';

// TODO: make sure all timestamps in UTC

// TODO: replace new Error() with new QueryError()

var Promise = require('bluebird'),
  inherits = require('inherits'),
  pg = require('pg'),
  AbstractSQL = require('../../common'),
  SQLError = require('../../common/sql-error'),
  SocketClosedError = require('../../common/socket-closed-error'),
//  AddressNotFoundError = require('../../common/address-not-found-error'),
  DBMissingError = require('../../../../client/db-missing-error'),
  DBExistsError = require('../../../../client/db-exists-error'),
  log = require('../../../../utils/log'),
  connections = require('./connections'),
  EventEmitter = require('events').EventEmitter;

var SQL = function () {
  AbstractSQL.apply(this, arguments); // apply parent constructor
  this._connected = false;
  this._connection = null;
};

inherits(SQL, AbstractSQL);

pg.on('error', function (err) {
  // Some errors, e.g. "terminating connection due to administrator command" caused from the server
  // closing the connection will cause your app to crash unless we listen for them here.
  log.warning('postgres err=' + err.message);
});

// TODO: causes a listener memory leak with as there is only one instance of pg. Should each ORM
// have its own instance? Isn't that inefficient? Better to register error function instead?
// SQL.prototype.on = function (event, callback) {
//   pg.on(event, callback);
// };

SQL.prototype._template = function (i) {
  return '$' + i;
};

SQL.prototype._createDatabase = function (db) {
  // Note: IF NOT EXISTS doesn't work in Postgres
//  var self = this;
  // return this._query('CREATE DATABASE $1', [db]); // TODO: why doesn't this work?
console.log('SQL.prototype._createDatabase, CREATE DATABASE ' + this.escape(db));
  return this._query('CREATE DATABASE ' + this.escape(db));
};

// SQL.prototype.connect = function (db, host, username, password, port) {
//   var self = this,
//     connect = Promise.promisify(pg.connect, pg);
//   var con = 'postgres://' + username + ':' + password + '@' + host + '/' + self.escape(db);
//   self._config(db, host, username, password, port);
// console.log('SQL.prototype.connect1');
//   return connect(con).then(function (args) {
// console.log('SQL.prototype.connect2');
//     self._client = args[0];
// console.log('SQL.prototype.connect3');
//     self._execute = Promise.promisify(self._client.query, self._client);
// console.log('SQL.prototype.connect4');
//   }).catch(function (err) {
// console.log('SQL.prototype.connect5, err=', err);
//     if (err.code === '3D000') {
//       throw new DBMissingError(err.message);
//     } else {
//       throw err;
//     }
//   });
// };

var utils = require('../../../../utils'); // TODO: remove?

// // TODO: have to use a custom promisify here as need to include done when err or could create callback for error case. Probably best to make custom and just eliminate anything that is not needed
// var promisify = function (fn, thisArg) {
//   var self = this;
// console.log((new Date()).toUTCString(), 'promisify1');
//   return function () {
// console.log('promisify2');
//     var argsArray = utils.toArgsArray(arguments);
// console.log('promisify3');
//     return new Promise(function (resolve, reject) {
// console.log('promisify4');
//
//       // Define a callback and add it to the arguments
//       var callback = function (err) {
// console.log('promisify5');
//         if (err) {
// console.log('promisify5a');
// console.log('err=', err);
// console.log('arguments=', arguments);
// err._done = arguments[2]; // TODO: set done for class instead!
//           reject(err);
//         } else if (arguments.length === 2) { // single param?
// console.log('promisify5b');
//           resolve(arguments[1]);
//         } else { // multiple params?
// console.log('promisify5c');
//           var cbArgsArray = utils.toArgsArray(arguments);
//           resolve(cbArgsArray.slice(1)); // remove err arg
//         }
//       };
//
// console.log('promisify6');
//       argsArray.push(callback);
// console.log('promisify7, argsArray=', argsArray);
// // TODO: why is it not getting past here???
//       fn.apply(thisArg, argsArray);
// console.log((new Date()).toUTCString(), 'promisify8');
//     });
//   };
// };

// SQL.prototype.connect = function (db, host, username, password, port) {
//   var self = this,
//     connect = promisify(pg.connect, pg);
//
// //  var self = this;
//
// // var self = this,
// //   connect = Promise.promisify(pg.connect, pg);
//   var con = 'postgres://' + username + ':' + password + '@' + host + '/' + self.escape(db);
//   self._config(db, host, username, password, port);
// console.log('SQL.prototype.connect, con=', con);
// // throw new Error('who is calling this?');
//
// // var connect = function (con) {
// // console.log('############connect1');
// //   return new Promise(function (resolve, reject) {
// // console.log('############connect2');
// //     pg.connect(con, function (err, client, done) {
// // console.log('############connect3');
// //       if (err) {
// // console.log('############connect4, err=', err.code);
// //         reject(err);
// //       }
// // // TODO: need to call done for some errors?
// //       return [client, done];
// //     });
// //   });
// // };
//
// console.log('SQL.prototype.connect1');
//   return connect(con).then(function (args) {
// console.log('SQL.prototype.connect2');
//     self._connected = true;
//     self._client = args[0];
//     self._done = args[1];
// console.log('SQL.prototype.connect3');
//     self._execute = Promise.promisify(self._client.query, self._client);
// console.log('SQL.prototype.connect4');
//   }).catch(function (err) {
// self._done = err._done; // TODO: use done for class instead!
// console.log('SQL.prototype.connect5, err=', err, '_done=', self._done);
//
//     if (self._done) {
//       // Release the client back to the pool. Without this a drop db could cause a client to hang
//       self._done();
//     }
//     if (err.code === '3D000') {
//       throw new DBMissingError(err.message);
// //     } else if (err.code === 'ENOTFOUND') {
// // throw err;
// // // TODO: should only do once?
// // // return self.connect(db, host, username, password, port);
// //
// // //        throw new AddressNotFoundError(err.message);
//     } else {
//       throw err;
//     }
//   });
// };

SQL.prototype.connect = function (db, host, username, password, port) {
console.log('SQL.prototype.connect, db=', db, 'host=', host);
  var self = this;
  self._config(db, host, username, password, port);
  return connections.connect(db, host, username, password, port).then(function (connection) {
    self._connection = connection;
    self._connected = true;

    self._connection.connection.on('disconnect', function () {
      self.emit('disconnect');
    });
  }).catch(function (err) {
console.log('SQL.prototype.connect5, err=', err, 'err.stack', err.stack);
    if (err.code === '3D000') {
      throw new DBMissingError(err.message);
    } else {
      throw err;
    }
  });
};

// SQL.prototype.dbExists = function (db, host, username, password, port) {
//   var sql = new SQL();
//   return sql.connect(db, host, username, password, port).then(function () {
//     return sql.close();
//   }).then(function () {
// console.log('SQL.prototype.dbExists, db=', db, 'EXISTS');
//     return true;
//   }).catch(function (err) {
//     if (err instanceof DBMissingError) {
// console.log('SQL.prototype.dbExists, db=', db, 'DOES NOT EXIST');
//       return false;
//     } else {
//       throw err;
//     }
//   });
// };

SQL.prototype.dbExists = function (db, host, username, password, port) {
  var sql = new SQL(), exists = false;
  return sql.connect('postgres', host, username, password, port).then(function () {
    return sql._query('SELECT 1 FROM pg_database WHERE datname=$1', [db]);
  }).then(function (results) {
    exists = results.rows ? true : false;
    return sql.close();
  }).then(function () {
    return exists;
  });
};

SQL.prototype.createAndUse = function (db, host, username, password, port) {
  // Note: need to specify a DB when connecting
  var self = this;
  // Connect to postgres db, create db and then connect to new db
console.log('SQL.prototype.createAndUse1, db=', db);
  return self.connect('postgres', host, username, password, port).then(function () {
console.log('SQL.prototype.createAndUse2, db=', db);
    return self._createDatabase(db);
  }).then(function () {
console.log('SQL.prototype.createAndUse3, db=', db);
    return self.close();
  }).then(function () {
console.log('SQL.prototype.createAndUse4, db=', db, 'host=', host, 'username=', username, 'password=', password);
// if (db === 'delta_mydb') {
// console.log('exiting, shouldnt mydb exist?');
// process.exit(1); // TODO: remove
// }
    return self.connect(db, host, username, password, port);
  });
};

// // TODO: remove?
// SQL.prototype.connectAndUse = function (db, host, username, password, port) {
//   // Note: need to specify a DB when connecting
//   var self = this;
//   return self.connect(db, host, username, password, port).catch(function () {
//     return self.createAndUse(db, host, username, password, port);
//   });
// };

SQL.prototype._isDBMissingError = function (err) {
var is = err.message.match(/^database ".*" does not exist$/);
console.log('SQL.prototype._isDBMissingError, is=', is, 'err=', err.message);
  return err.message.match(/^database ".*" does not exist$/);
};

SQL.prototype._isDBExistsError = function (err) {
var is = err.message.match(/^duplicate key value violates unique constraint "pg_database_datname_index"$/) || err.message.match(/^database ".*" already exists$/);
console.log('------------------------SQL.prototype._isDBExistsError, is=', is, 'err=', err.message);
  return err.message.match(
      /^duplicate key value violates unique constraint "pg_database_datname_index"$/)
    || err.message.match(
      /^database ".*" already exists$/);
};

// SQL.prototype._isSocketClosedError = function (err) {
// var is = err.message === 'This socket has been ended by the other party';
// console.log('SQL.prototype._isSocketClosedError, is=', is, 'err=', err.message);
//   return err.message === 'This socket has been ended by the other party';
// };

// SQL.prototype._query = function (sql, replacements) {
//   var self = this;
//   self._log('sql=' + sql + ', replacements=' + JSON.stringify(replacements) + '\n');
//   return self._execute(sql, replacements).then(function (results) {
//     return {
//       rows: results.rows.length > 0 ? results.rows : null,
//       affected: results.rowCount
//     };
//   }).catch(function (err) {
//     if (self._isDBMissingError(err)) {
//       throw new DBMissingError(err.message);
//    } else if (self._isDBExistsError(err)) {
// // console.log('here you go!');
// // process.exit(1);
//      throw new DBExistsError(err.message);
//     } else {
//       // TODO: a wrapper should be created in sql/sql.js and this should be moved there
//       throw new SQLError(err + ', sql=' + sql + ', replacements=' + JSON.stringify(replacements));
//     }
//   });
// };

SQL.prototype._query = function (sql, replacements) {
  var self = this;
  self._log('sql=' + sql + ', replacements=' + JSON.stringify(replacements) + '\n');
  return self._connection.connection.query(sql, replacements).then(function (results) {
    return {
      rows: results.rows.length > 0 ? results.rows : null,
      affected: results.rowCount
    };
  }).catch(function (err) {
    if (err instanceof SocketClosedError) {
      throw err;
    } else if (self._isDBMissingError(err)) {
      throw new DBMissingError(err.message);
    } else if (self._isDBExistsError(err)) {
      throw new DBExistsError(err.message);
// } else if self._isSocketClosedError(err)) {
//  throw new SocketClosedError(err.message);
    } else {
      // TODO: a wrapper should be created in sql/sql.js and this should be moved there
      throw new SQLError(err + ', sql=' + sql + ', replacements=' + JSON.stringify(replacements));
    }
  });
};

// // TODO: move to common?
// SQL.prototype.ping = function () {
// console.log('SQL.prototype.ping1');
//   if (this._connected) {
// console.log('SQL.prototype.ping2');
//     return this._query('SELECT NOW()').catch(function (err) {
//       // If the following query generates a SocketClosedError then the connection will automatically
//       // be flagged as closed
// console.log('SQL.prototype.ping3');
//       if (!(err instanceof SocketClosedError)) {
// console.log('SQL.prototype.ping4');
//         throw err;
//       }
//     });
//   } else {
// console.log('SQL.prototype.ping5');
//     return Promise.resolve();
//   }
// };

// TODO: move to common?
SQL.prototype.ping = function () {
console.log('SQL.prototype.ping1');
  if (this._connected) {
console.log('SQL.prototype.ping2');
    // If the following query generates a SocketClosedError then the connection will automatically
    // be flagged as closed
    return this._query('SELECT NOW()');
  } else {
console.log('SQL.prototype.ping3');
    return Promise.resolve();
  }
};

SQL.prototype.insert = function (record, table, id, raw) {
  var self = this,
    joined = self._escapeAndJoin(record, raw);
  var sql = 'INSERT INTO ' + self.escape(table) + ' (' + joined.attrs +
    ') VALUES (' + joined.templates + ') RETURNING ' + self.escape(id);
  return self._query(sql, joined.replacements).then(function (results) {
    self._log('created ' + table + ' rec with id=' + results.rows[0].id + '\n');
    return results.rows[0].id;
  });
};

SQL.prototype._index = function (table, attr) {
  return ' CREATE INDEX ' + this.escape(table + '_index_' + attr) + ' ON ' + this.escape(table) +
    ' USING btree (' + this.escape(attr) + ');';
};

SQL.prototype._tableAttrType = function (type, table, attr) {
  // Note: Postgres does not support unsigned types
  var sql = '',
    suffixSql = '';
  switch (type) {
  case 'primary':
    sql = 'SERIAL PRIMARY KEY';
    break;
  case 'key':
    sql = 'INTEGER';
    suffixSql = this._index(table, attr);
    break;
  case 'varchar':
    sql = 'VARCHAR';
    break;
  case 'varbinary':
    sql = 'VARCHAR';
    break;
  case 'text':
    sql = 'TEXT';
    break;
  case 'timestamp':
    sql = 'TIMESTAMPTZ';
    break;
  case 'datetime':
    sql = 'TIMESTAMPTZ';
    break;
  case 'enum':
    sql = this.escape(table + '_enum_' + attr);
    break;
  case 'smallint':
    sql = 'SMALLINT';
    break;
  case 'boolean':
    sql = 'BOOLEAN';
    break;
  default:
    throw new Error('type ' + type + ' not supported');
  }
  return {
    sql: sql,
    suffixSql: suffixSql
  };
};

SQL.prototype._default = function (def) {
  switch (def) {
  case 'currenttimestamp':
    return 'CURRENT_TIMESTAMP';
  default:
    throw new Error('default ' + def + ' not supported');
  }
};

SQL.prototype._tableAttr = function (table, attr, schema) {
  var sql = attr,
    prefixSql = '',
    suffixSql = '';
  for (var prop in schema) {
    var propVal = schema[prop];
    switch (prop) {
    case 'type':
      var r = this._tableAttrType(propVal, table, attr);
      sql += ' ' + r.sql + (schema.length ? '(' + schema.length + ')' : '');
      suffixSql += r.suffixSql;
      break;

    case 'default':
      sql += ' DEFAULT ' + this._default(propVal);
      break;

    case 'unique':
      if (propVal) {
        sql += ' UNIQUE';
      }
      break;

    case 'null':
      if (!propVal) {
        sql += ' NOT NULL';
      }
      break;

    case 'index':
      suffixSql += this._index(table, attr);
      break;

    case 'values':
      var name = this.escape(table + '_enum_' + attr);
      var values = '';
      for (var i in propVal) {
        values += (i > 0 ? ",'" : "'") + this.escape(propVal[i]) + "'";
      }
      prefixSql += ' CREATE TYPE ' + name + ' AS ENUM (' + values + ');';
      break;
    }
  }
  return {
    sql: sql,
    prefixSql: prefixSql,
    suffixSql: suffixSql
  };
};

SQL.prototype._uniqueSql = function (table, indexes) {
  if (!indexes) {
    return '';
  }
  var sql = '';
  for (var i = 0; i < indexes.length; i++) {
    var joined = this._escapeAndJoinForIndex(indexes[i].attrs);
    var where = '';
    if (indexes[i].null || indexes[i].full) {
      // TODO: support more than 1 null and full element and
      if (indexes[i].null) {
        where = ' WHERE ' + this.escape(indexes[i].null[0]) + ' IS NULL';
      } else {
        where = ' WHERE ' + this.escape(indexes[i].full[0]) + ' IS NOT NULL';
      }
    }
    sql += ' CREATE UNIQUE INDEX ' + this.escape(table + '_unique_' + i) + ' ON ' + this.escape(
      table) + ' (' + joined.attrs + ')' + where + ';';
  }
  return sql;
};

SQL.prototype._resetSequenceSQL = function (table, attr, primaryStart) {
  return "SELECT setval('" + this.escape(table + '_' + attr + '_seq') + "','" + this.escape(
    primaryStart) + "')";
};

SQL.prototype._resetSequence = function (table, attr, primaryStart) {
  return this._query(this._resetSequenceSQL(table, attr, primaryStart));
};

// e.g.
// {
//   id: { type: 'primary' },
//   doc_id: { type: 'key' },
//   user_id: { type: 'key', null: false },
//   name: { type: 'varchar', length: 10 },
//   value: { type: 'text' },
//   destroyed_at: { type: 'datetime', default: 'currenttimestamp' },
//   updated_at: { type: 'timestamp' },
//   uuid: { type: 'varbinary', length: 36, unique: true },
//   status: { type: 'enum', values: ['enabled', 'disabled'] }
// }
SQL.prototype.createTable = function (table, schema, unique, primaryStart) {
  var sql = ' CREATE TABLE IF NOT EXISTS ' + this.escape(table) + '(',
    prefixSql = '',
    suffixSql = '',
    delim = ' ',
    priStartSql = '';
  for (var attr in schema) {
    var r = this._tableAttr(table, attr, schema[attr]);
    sql += delim + r.sql;
    prefixSql += r.prefixSql;
    suffixSql += r.suffixSql;
    delim = ', ';

    if (primaryStart && schema[attr].type === 'primary') {
      priStartSql = this._resetSequenceSQL(table, attr, primaryStart) + ';';
    }
  }
  sql += ');';
  return this._query(prefixSql + sql + suffixSql + this._uniqueSql(table, unique) + priStartSql);
};

// TODO: rename to disconnect?
SQL.prototype.close = function () {
  var self = this;
  return connections.disconnect(self._connection.id, self._db, self._host, self._username,
    self._password, self._port)
      .then(function () {
        self._connected = false;
        self._connection.connection.removeAllListeners(); // prevent listener leak
      });
};

// SQL.prototype.close = function () {
//   var self = this;
//   return new Promise(function (resolve) {
//     // The following causes errors like "This socket has been ended by the other party"
//     // if (self._done) {
//     //   self._done();
//     // }
//
//     self._client.end(); // not async!
//     self._connected = false;
//     resolve();
//   });
// };

SQL.prototype._closeOtherConnections = function (db) {
  return this._query('SELECT pg_terminate_backend (pid) FROM pg_stat_activity WHERE datname=$1',
    [db]);
};

SQL.prototype._dropDatabase = function (db, force) {
console.log('SQL.prototype._dropDatabase, db=', db, 'force=', force);
  // Postgres will not let you drop a DB if there are any other connections to the DB
  var self = this, promise = null;

  if (force) {
    promise = self._closeOtherConnections(db);
  } else {
    promise = Promise.resolve();
  }

  return promise.then(function () {
console.log('^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^');
console.log('DROP ', db);
console.log('^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^');
    // return self._query('DROP DATABASE $1', [db]); // TODO: why doesn't this work?
console.log('SQL.prototype._dropDatabase, DROP DATABASE ' + self.escape(db));
    return self._query('DROP DATABASE ' + self.escape(db));
//   }).catch(function (err) {
// console.log('^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^');
// console.log('err=', err, 'err.stack=', err.stack);
// console.log('^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^');
//     throw err;
  });
};

// Need to pass in host, username, password, port as may not have already connected to DB.
// TODO: refactor and put host, username, password, port in SQL constructor?
SQL.prototype.dropAndCloseDatabase = function (db, host, username, password, port, force) {

console.log('SQL.prototype.dropAndCloseDatabase1, db=', db);
  var self = this,
//    db = self._db,
    promise = null;

  if (self._connected) {
console.log('SQL.prototype.dropAndCloseDatabase1a');
    promise = self.close(); // cannot drop current database
  } else {
console.log('SQL.prototype.dropAndCloseDatabase1b');
    promise = Promise.resolve();
  }

console.log('SQL.prototype.dropAndCloseDatabase2');
  return promise.then(function () {
console.log('SQL.prototype.dropAndCloseDatabase3');
// console.log('SQL.prototype.dropAndCloseDatabase3, self._username=', self._username);
    return self.connect('postgres', host, username, password, port);
  }).then(function () {
console.log('SQL.prototype.dropAndCloseDatabase4');
// self._debug = true;
    return self._dropDatabase(db, force);
  }).then(function () {
console.log('SQL.prototype.dropAndCloseDatabase5');
// self._debug = false;
    return self.close();
  });
};

// Postgres doesn't appear to have a REPLACE command so we need to insert and then if that fails,
// update
// TODO: should insert/replace return results with id set instead of just id?
SQL.prototype.replace = function (record, table, id, where, raw) {
  var self = this;
  return self.insert(record, table, id, raw).catch(function (err) {
    if (!(err instanceof SQLError)) {
      throw err;
    }
    return self.update(record, table, where, raw);
  });
};

SQL.prototype.truncateTable = function (table, priAttr, priStart) {
  var self = this;
  return self._truncateTable(table).then(function (param) {
    if (priAttr && priStart) {
      return self._resetSequence(table, priAttr, priStart).then(function () {
        return param;
      });
    }
    return param;
  });
};

// Precondition: same number of $i parameters as replacements.length
// Note: this is currently only needed for nested queries. All other queries should use the native
// escaping functionality.
SQL.prototype.build = function (sql, replacements) {
  var self = this,
    parts = sql.split(/\$\d*/);
  var newParts = [];
  parts.forEach(function (part, i) {
    if (i > 0) {
      newParts.push("'" + self.escape(replacements[i - 1]) + "'"); // insert escaped param
    }
    newParts.push(part);
  });
  return newParts.join('');
};

module.exports = SQL;
