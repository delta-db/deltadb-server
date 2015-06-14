'use strict';

var Cursor = function () {};

Cursor.prototype.array = function () {
  var self = this,
    items = [];
  return self.each(function (item) {
    items.push(item);
  }).then(function () {
    return items;
  });
};

module.exports = Cursor;