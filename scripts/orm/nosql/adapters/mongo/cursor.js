'use strict';

var inherits = require('inherits'),
  AbstractCursor = require('../../cursor'),
  Doc = require('./doc');

var Cursor = function (cursor, col) {
  this._cursor = cursor;
  this._col = col;
};

inherits(Cursor, AbstractCursor);

// TODO: make a promise that resolves after last each
Cursor.prototype.each = function (callback) {
  var self = this;
  self._cursor.each(function (err, doc) {
    if (doc) {
      callback(new Doc(doc, self._col));
    }
  });
};

module.exports = Cursor;
