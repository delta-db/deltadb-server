'use strict';

var Where = function () {};

var cmp = function (p1, op, p2) {
  switch (op) {
  case 'or':
    return p1 || p2;
  case 'and':
    return p1 && p2;
  case '=':
    return p1 === p2;
  case '!=':
    return p1 !== p2;
  case '>':
    return p1 > p2;
  case '<':
    return p1 < p2;
  case '>=':
    return p1 >= p2;
  case '<=':
    return p1 <= p2;
  default:
    throw new Error('operator ' + op + ' not supported');
  }
};

// Examples:
// ['age', '<', 33]
// [ ['age', '<', 33], 'or', ['name', '=', 'Jill'] ]
// [ ['age', '<', 33], 'and', ['name', '=', 'Jill'] ]
// [ [ ['age', '<', 33], 'and', ['name', '=', 'Jill'] ], 'or', [ ['age', '>', 33], 'and',
//   ['name', '=', 'Jack'] ] ]
var is = function (doc, where) {
  if (!Array.isArray(where) || where.length !== 3) {
    throw new Error('where statement ' + JSON.stringify(where) + ' must be an array of size 3');
  }
  if (Array.isArray(where[0])) { // e.g. [ ['age', '<', 33], 'or', ['name', '=', 'Jill'] ]
    return cmp(is(doc, where[0]), where[1], is(doc, where[2]));
  } else { // e.g. ['age', '>', 20]
    return cmp(doc[where[0]], where[1], where[2]);
  }
};

Where.prototype.filter = function (where) {
  return function (doc) {
    return is(doc, where);
  };
};

module.exports = new Where();