'use strict';

// TODO: remove use of "AS", e.g. use "myattr myattralias" instead of "myattr AS myattralias"

// TODO: replace new Error() with something like new QueryError()

var utils = require('../../../utils'),
  MissingError = require('./missing-error');

// If SQL is written carefully, it is highly portable between MySQL and Postgres. Using the
// structure in this class allows us to abstract the differences in SQL implementations.
var SQL = function () {};

SQL.prototype._debug = false;

SQL.prototype.escape = function (value) {
  var t = typeof value;
  if (t === 'number') {
    return value;
  } else if (t === 'string') {
    return value.replace(/[^0-9a-z_.]/gim, '').toLowerCase();
  } else {
    throw new Error(value + ' must be a string or number');
  }
};

SQL.prototype._template = function ( /* i */ ) {
  return '?';
};

SQL.prototype._escapeAndJoin = function (obj, raw) {
  var self = this,
    keys = '',
    templates = '',
    values = [],
    delim = '',
    i = 1;
  utils.each(obj, function (val, key) {
    if (typeof val !== 'undefined') {
      keys += delim + self.escape(key);
      if (raw && raw[key]) {
        templates += delim + val;
      } else {
        templates += delim + self._template(i++);
        values.push(val);
      }
      delim = ',';
    }
  });
  return {
    attrs: keys,
    templates: templates,
    replacements: values
  };
};

SQL.prototype._escapeAndJoinForUpdate = function (obj, raw) {
  var self = this,
    keys = '',
    values = [],
    delim = '',
    i = 1;
  utils.each(obj, function (val, key) {
    if (raw && raw[key]) {
      keys += delim + self.escape(key) + '=' + val;
    } else {
      keys += delim + self.escape(key) + '=' + self._template(i++);
      values.push(val);
    }
    delim = ',';
  });
  return {
    attrs: keys,
    replacements: values
  };
};

SQL.prototype._escapeAndJoinForIndex = function (obj) {
  var self = this,
    attrs = '',
    delim = '';
  utils.each(obj, function (val) {
    attrs += delim + self.escape(val);
    delim = ',';
  });
  return {
    attrs: attrs
  };
};

SQL.prototype._config = function (db, host, username, password, port) {
  this._db = db;
  this._host = host;
  this._username = username;
  this._password = password;
  this._port = port;
};

// SQL.prototype.connectAndUse = function ( /* db, host, username, password, port */ ) {};

// Finalize schema, e.g.
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
// SQL.prototype.createTable = function ( /* table, schema */ ) {};

SQL.prototype.dropTable = function (table) {
  return this._query('DROP TABLE ' + this.escape(table));
};

// SQL.prototype._query = function ( /* sql, replacements */ ) {};

// e.g. var joins = { 
//   joins: {
//     docs: [ ['docs.obj_id', '=', 'objs.id'], 'or' , ['doc.user_id', '=', '?'] ],
//     users: [ ['users.user_id', '=', 'docs.id'], 'and' , ['doc.user_id', '=', '?'] ]
//   },
//   left_joins: {
//     attrs: ['attrs.doc_id', '=', 'docs.id']
//   }
// };
SQL.prototype._from = function (table, joins, replacements) {
  // Note: join aliases can be done like
  // joins = { joins: { "mytable mytablealias": ['mytablealis.id', '=', '1'] } }
  var from = ' FROM ' + this.escape(table);
  if (typeof joins !== 'undefined') {
    for (var op in joins) {
      var tbls = joins[op];
      for (var tbl in tbls) {
        var stmt = tbls[tbl];
        var parsedTbl = tbl.split(' ');
        var tblAndAlias =
          this.escape(parsedTbl[0]) + (parsedTbl[1] ? ' ' + this.escape(parsedTbl[1]) : '');
        from += this._joinOp(op) + ' ' + tblAndAlias + ' ON ' + this._whereExp(stmt, replacements);
      }
    }
  }
  return from;
};

SQL.prototype._joinOp = function (op) {
  switch (op) {
  case 'joins':
    return ' JOIN';
  case 'left_joins':
    return ' LEFT JOIN';
  case 'full_outer_joins':
    return ' FULL OUTER JOIN';
  case 'right_joins':
    return ' RIGHT JOIN';
  case 'inner_joins':
    return ' INNER JOIN';
  default:
    throw new Error('invalid join op ' + op);
  }
};

SQL.prototype._escapeAndJoinForSelect = function (obj) {
  var self = this,
    values = '',
    delim = '',
    isArray = Array.isArray(obj);
  utils.each(obj, function (val, key) {
    if (isArray) {
      val = self.escape(val);
      values += delim + val + ' AS "' + val + '"'; // use alias to prevent dups      
    } else {
      values += delim + self.escape(key) + ' AS "' + self.escape(val) + '"';
    }
    delim = ',';
  });
  return values;
};

// TODO: what if want to use function in select? e.g. to_timestamp(updated_at, 'HH:MI:SS.MS.US')
SQL.prototype._select = function (attrs, distinct) {
  return 'SELECT ' + (distinct ? 'DISTINCT ' : '') + (attrs ? this._escapeAndJoinForSelect(attrs) :
    '*');
};

SQL.prototype._opExp = function (op, p2) {
  op = op.toUpperCase();

  if (typeof p2 === 'string' && p2.toUpperCase() === 'NULL') {
    switch (op) {
    case '=':
      return ' IS NULL';
    case '!=':
      return ' IS NOT NULL';
    default:
      throw new Error('operator ' + op + ' not supported');
    }
  }

  switch (op) {
  case 'OR':
  case 'AND':
    return ' ' + op + ' ' + p2;

  case '=':
  case '!=':
  case '>':
  case '<':
  case '>=':
  case '<=':
    return op + p2;

  case '~':
    return ' LIKE ' + p2;

  case '!~':
    return ' NOT LIKE ' + p2;

  case 'IN':
    return ' IN (' + p2 + ')';

  case '!IN':
    return ' NOT IN (' + p2 + ')';

  default:
    throw new Error('operator ' + op + ' not supported');
  }
};

SQL.prototype._isRaw = function (value) {
  return value.length >= 2 && value.charAt(0) === '{' && value.charAt(value.length - 1) === '}';
};

SQL.prototype._isLiteral = function (value) {
  return value.length >= 2 && value.charAt(0) === '"' && value.charAt(value.length - 1) === '"';
};

SQL.prototype._literal = function (value) {
  return value.substr(1, value.length - 2);
};

// e.g. [ ['age', '<', '"33"'], 'or', ['users.name', '=', '"Jill"'], 'or',
//        ['users.location', '=', 'users.hometown'] ]
SQL.prototype._whereExp = function (stmt, replacements) {

  if (Array.isArray(stmt) && stmt.length < 3) {
    throw new Error('where statement ' + JSON.stringify(stmt) +
      ' must be an array of size 3 or larger');
  }

  if (!Array.isArray(stmt)) {
    if (this._isLiteral(stmt)) {
      replacements.push(this._literal(stmt));
      return this._template(replacements.length);
    } else if (this._isRaw(stmt)) {
      return stmt.substr(1, stmt.length - 2);
    } else {
      return this.escape(stmt);
    }
  }

  var sql = this._whereExp(stmt[0], replacements);
  for (var i = 1; i < stmt.length; i += 2) {
    var op = stmt[i],
      p2 = stmt[i + 1];
    sql += this._opExp(op, this._whereExp(p2, replacements));
  }
  return '(' + sql + ')';
};

SQL.prototype._where = function (where, replacements) {
  return where ? ' WHERE ' + this._whereExp(where, replacements) : '';
};

SQL.prototype._orderExp = function (orders) {
  if (!Array.isArray(orders)) {
    throw new Error('order must be an array');
  }
  if (!Array.isArray(orders[0])) { // e.g. ['age', 'asc']
    orders = [orders];
  }
  var sql = '',
    delim = '';
  for (var i = 0; i < orders.length; i++) {
    var order = orders[i];
    if (!Array.isArray(order) || order.length !== 2) {
      throw new Error('order ' + JSON.stringify(order) + ' must be an array of size 2');
    }
    if (order[1] !== 'asc' && order[1] !== 'desc') {
      throw new Error('invalid direction ' + order[1]);
    }
    sql += delim + this.escape(order[0]) + (order[1] === 'desc' ? ' DESC' : ' ASC');
    delim = ',';
  }
  return sql;
};

SQL.prototype._order = function (order) {
  return order ? ' ORDER BY ' + this._orderExp(order) : '';
};

SQL.prototype._limit = function (limit) {
  return limit ? ' LIMIT ' + this.escape(limit) : '';
};

SQL.prototype._offset = function (offset) {
  return (offset ? ' OFFSET ' + this.escape(offset) : '');
};

SQL.prototype._group = function (group) {
  if (!group) {
    return '';
  }
  var self = this,
    by = ' GROUP BY ',
    first = true;
  group.forEach(function (item) {
    by += (first ? '' : ',') + self.escape(item);
    first = false;
  });
  return by;
};

// TODO: how to properly handle replacements in nested query??? For now, require that nested queries
// have no replacements?
SQL.prototype.findSQL = function (attrs, table, joins, where, order, limit, offset, group, distinct,
  throwIfMissing, replacements) {
  var sql =
    this._select(attrs, distinct) + this._from(table, joins, replacements) + this._where(where,
      replacements) + this._group(group) + this._order(order) + this._limit(limit) +
    this._offset(offset);
  return sql;
};

SQL.prototype.find = function (attrs, table, joins, where, order, limit, offset, group, distinct,
  throwIfMissing) {
  var replacements = [];
  var sql = this.findSQL(attrs, table, joins, where, order, limit, offset, group, distinct,
    throwIfMissing, replacements);
  return this._query(sql, replacements).then(function (results) {
    if (throwIfMissing && !results.rows) {
      throw new MissingError('missing record');
    }
    return results;
  });
};

SQL.prototype.findAndThrowIfMissing = function (attrs, table, joins, where, order, limit, offset,
  group, distinct) {
  return this.find(attrs, table, joins, where, order, limit, offset, group, distinct, true);
};

// SQL.prototype.insert = function ( /* record, table, id, raw */ ) {};

SQL.prototype.update = function (record, table, where, raw) {
  var joined = this._escapeAndJoinForUpdate(record, raw);
  var sqlWhere = this._where(where, joined.replacements);
  var sql = 'UPDATE ' + this.escape(table) + ' SET ' + joined.attrs + sqlWhere;
  return this._query(sql, joined.replacements);
};

SQL.prototype._delete = function (table) {
  return ' DELETE FROM ' + this.escape(table);
};

SQL.prototype.destroy = function (table, where) {
  var replacements = [];
  var sql =
    this._delete(table) + this._where(where, replacements);
  return this._query(sql, replacements);
};

// SQL.prototype.close = function () {};

// SQL.prototype.dropAndCloseDatabase = function () {};

SQL.prototype._truncateTable = function (table) {
  return this._query('TRUNCATE TABLE ' + this.escape(table));
};

SQL.prototype._log = function (msg) {
  if (this._debug) {
    console.log(msg);
  }
};

module.exports = SQL;