'use strict';

// TODO: make sure all timestamps in UTC

// TODO: client pooling? See pg README

// TODO: replace new Error() with new QueryError()

var Promise = require('bluebird'),
  inherits = require('inherits'),
  pg = require('pg'),
  AbstractSQL = require('../../common'),
  SQLError = require('../../common/sql-error'),
  DBMissingError = require('../../../../client/db-missing-error');

var SQL = function () {};

inherits(SQL, AbstractSQL);

pg.on('error', function (err) {
  // Some errors, e.g. "terminating connection due to administrator command" caused from the server
  // closing the connection will cause your app to crash unless we listen for them here.
  // TODO: should we do anything here like write to a log?
});

SQL.prototype._template = function (i) {
  return '$' + i;
};

SQL.prototype._createDatabase = function (db) {
  // Note: IF NOT EXISTS doesn't work in Postgres
  var self = this;
  db = self.escape(db);
  return self._query('CREATE DATABASE ' + db);
};

SQL.prototype.connect = function (db, host, username, password, port) {
  var self = this,
    connect = Promise.promisify(pg.connect, pg);
  var con = 'postgres://' + username + ':' + password + '@' + host + '/' + self.escape(db);
  self._config(db, host, username, password, port);
  return connect(con).then(function (args) {
    self._client = args[0];
    self._execute = Promise.promisify(self._client.query, self._client);
  }).catch(function (err) {
    if (err.code === '3D000') {
      throw new DBMissingError(err.message);
    }
  });
};

SQL.prototype.createAndUse = function (db, host, username, password, port) {
  // Note: need to specify a DB when connecting
  var self = this;
  // Connect to postgres db, create db and then connect to new db
  return self.connect('postgres', host, username, password, port).then(function () {
    return self._createDatabase(db);
  }).then(function () {
    return self.close();
  }).then(function () {
    return self.connect(db, host, username, password, port);
  });
};

// TODO: remove?
SQL.prototype.connectAndUse = function (db, host, username, password, port) {
  // Note: need to specify a DB when connecting
  var self = this
  return self.connect(db, host, username, password, port).catch(function () {
    return self.createAndUse(db, host, username, password, port);
  });
};

SQL.prototype._query = function (sql, replacements) {
  this._log('sql=' + sql + ', replacements=' + JSON.stringify(replacements) + '\n');
  return this._execute(sql, replacements).then(function (results) {
    return {
      rows: results.rows.length > 0 ? results.rows : null,
      affected: results.rowCount
    };
  }).catch(function (err) {
    // TODO: a wrapper should be created in sql/sql.js and this should be moved there
    throw new SQLError(err + ', sql=' + sql + ', replacements=' + JSON.stringify(replacements));
  });
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

SQL.prototype.close = function () {
  var self = this;
  return new Promise(function (resolve) {
    self._client.end(); // not async!
    resolve();
  });
};

SQL.prototype._closeOtherConnections = function (db) {
  return this._query('SELECT pg_terminate_backend (pid) FROM pg_stat_activity WHERE datname=$1',
    [db]);
};

SQL.prototype._dropDatabase = function (db, force) {
  // Postgres will not let you drop a DB if there are any other connections to the DB
  var self = this, promise = null;
  
  if (force) {
    promise = self._closeOtherConnections(db);
  } else {
    promise = Promise.resolve();
  }

  return promise.then(function () {
    return self._query('DROP DATABASE ' + self.escape(db));
  });
};

SQL.prototype.dropAndCloseDatabase = function (force) {
  // Note: Cannot drop current database
  var self = this,
    db = self._db;
  return self.close().then(function () {
    return self.connect('postgres', self._host, self._username, self._password, self._port);
  }).then(function () {
    return self._dropDatabase(db, force);
  }).then(function () {
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