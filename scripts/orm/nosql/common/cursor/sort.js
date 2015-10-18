'use strict';

var inherits = require('inherits'),
  Cursor = require('./index'),
  ArrayCursor = require('./array');

var SortCursor = function (cursor, compare) {
  this._cursor = cursor;
  this._compare = compare;
};

inherits(SortCursor, Cursor);

SortCursor.prototype.each = function (callback) {
  var self = this;
  return self._cursor.array().then(function (docs) {
    docs.sort(self._compare);
    var cursor = new ArrayCursor(docs);
    return cursor.each(callback);
  });
};

module.exports = SortCursor;
