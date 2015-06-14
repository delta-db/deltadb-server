'use strict';

var Where = function () {};

Where.prototype.escape = function (str) {
  return str.replace(/\W+/g, '').toLowerCase();
};

var format = function (op) {
  op = op.toUpperCase();
  switch (op) {
  case 'OR':
  case 'AND':
    return ' ' + op + ' ';

  case '=':
  case '!=':
  case '>':
  case '<':
  case '>=':
  case '<=':
    return op;

  default:
    throw new Error('operator ' + op + ' not supported');
  }
};

Where.prototype.sql = function (stmt) {
  if (!Array.isArray(stmt) || stmt.length < 3) {
    throw new Error('where statement ' + JSON.stringify(stmt) +
      ' must be an array of size 3 or larger');
  }
  // e.g. [ ['age', '<', 33], 'or', ['name', '=', 'Jill'] , 'or', ['name', '=', '?'] ]
  var sql = '',
    p1 = stmt[0];
  p1 = Array.isArray(p1) ? this.sql(p1) : this.escape(p1);
  for (var i = 1; i < stmt.length; i += 2) {
    var op = stmt[i],
      p2 = stmt[i + 1];
    p2 = Array.isArray(p2) ? this.sql(p2) : (p2 === '?' ? '?' : this.escape(p2));
    sql = p1 + format(op) + p2;
    p1 = sql;
  }
  return '(' + sql + ')';
};

module.exports = new Where();