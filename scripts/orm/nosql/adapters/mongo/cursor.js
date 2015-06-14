'use strict';

var inherits = require('inherits'),
  AbstractCursor = require('../../cursor'),
  Item = require('./item');

var Cursor = function (cursor, collection) {
  this._cursor = cursor;
  this._collection = collection;
};

inherits(Cursor, AbstractCursor);

// TODO: make a promise that resolves after last each
Cursor.prototype.each = function (callback) {
  var self = this;
  self._cursor.each(function (err, doc) {
    if (doc) {
      callback(new Item(doc, self._collection));
    }
  });
};

module.exports = Cursor;