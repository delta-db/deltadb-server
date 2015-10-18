'use strict';

var Order = function () {};

var cmp = function (p1, p2, direction) {
  if (p1 === p2) {
    return 0;
  }
  var r = p1 < p2 ? 1 : -1;
  return direction === 'desc' ? r : -r;
};

// Examples:
// ['age', 'asc']
// [ ['age', 'asc'], ['name', 'desc'] ]
var compare = function (a, b, order) {
  if (!Array.isArray(order)) {
    throw new Error('order statement ' + JSON.stringify(order) + ' must be an array');
  }
  if (Array.isArray(order[0])) { // e.g. [ ['age', 'asc'], ['name', 'desc'] ]
    var r = 0;
    for (var i in order) {
      r = compare(a, b, order[i]);
      if (r !== 0) { // break loop?
        break;
      }
    }
    return r;
  } else if (order.length !== 2) {
    throw new Error('order statement ' + JSON.stringify(order) + ' must be an array of size 2');
  } else { // e.g. ['age', 'asc']
    var aDoc = a.get(),
      bDoc = b.get(); // TODO: is get() too slow as it does copy? Use _doc instead?
    return cmp(aDoc[order[0]], bDoc[order[0]], order[1]);
  }
};

Order.prototype.sort = function (order) {
  return function (a, b) {
    return compare(a, b, order);
  };
};

module.exports = new Order();
