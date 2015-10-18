'use strict';

var Query = function () {};

// ['age', '=', '100'] => age: 100
// ['age', '!=', '100'] => age: { $ne: 100 }
// ['age', '>', '100'] => age: { $gt: 100 }
// ['age', '<', '100'] => age: { $lt: 100 }
// ['age', '<=', '100'] => age: { $lte: 100 }
// ['age', '>=', '100'] => age: { $gte: 100 }
var addExpression = function (query, criteria) {
  if (!Array.isArray(query) || query.length !== 3) {
    throw new Error('where expression must be an array of size 3');
  }

  var name = query[0],
    op = query[1],
    value = query[2];

  if (op === '=') {
    criteria[name] = value;
    return;
  }

  var mongoOp = null;
  switch (op) {
  case '!=':
    mongoOp = '$ne';
    break;

  case '>':
    mongoOp = '$gt';
    break;

  case '<':
    mongoOp = '$lt';
    break;

  case '>=':
    mongoOp = '$gte';
    break;

  case '<=':
    mongoOp = '$lte';
    break;

  default:
    throw new Error('invalid query operation ' + op);
  }

  criteria[name] = {};
  criteria[name][mongoOp] = value;
};

var addCriteria = function (query, criteria) {
  if (!Array.isArray(query) || query.length !== 3) {
    throw new Error('where statement must be an array of size 3');
  }
  if (Array.isArray(query[0])) {
    var op = query[1];
    if (op === 'or') {
      // e.g. [ ['age', '>', 20], 'or', ['name', '=', 'Jane'] ]
      //     =>  { $or: [ { age: { $lt: 33 } }, { name: 'Jane' } ] }
      criteria['$or'] = [{}, {}];
      addCriteria(query[0], criteria['$or'][0]);
      addCriteria(query[2], criteria['$or'][1]);
    } else {
      // e.g. [ ['age', '>', 20], 'and', ['name', '=', 'Jane'] ]
      //     => { age: { $gt: 20 }, name: 'Jane' }
      addCriteria(query[0], criteria);
      addCriteria(query[1], criteria);
    }
  } else { // e.g. ['age', '>', 20]
    addExpression(query, criteria);
  }
};

Query.prototype.addCriteria = addCriteria;

module.exports = new Query();
