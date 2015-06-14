'use strict';

var Promise = require('bluebird'),
  inherits = require('inherits'),
  Cursor = require('./index');

var ArrayCursor = function (items) {
  this._items = items;
};

inherits(ArrayCursor, Cursor);

ArrayCursor.prototype.each = function (callback) {
  var self = this;
  return new Promise(function (resolve) {
    self._items.forEach(function (item) {
      callback(item);
    });
    resolve();
  });
};

module.exports = ArrayCursor;