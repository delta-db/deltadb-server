'use strict';

var Promise = require('bluebird'),
  inherits = require('inherits'),
  AbstractCursor = require('../../cursor'),
  Doc = require('./item');

var Cursor = function (cursor, callbackWrapper, collection) {
  this._cursor = cursor;
  this._callbackWrapper = callbackWrapper;
  this._collection = collection;
};

inherits(Cursor, AbstractCursor);

Cursor.prototype.each = function (callback) {
  var self = this;
  return new Promise(function (resolve) {
    self._callbackWrapper.callback = function (cursor) {
      if (cursor) {
        callback(new Doc(cursor.value, self._collection));
        cursor.continue();
      } else {
        resolve();
      }
    };
    self._callbackWrapper.callback(self._cursor); // initial cursor already loaded
  });
};

module.exports = Cursor;