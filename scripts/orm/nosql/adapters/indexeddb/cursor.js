'use strict';

var Promise = require('bluebird'),
  inherits = require('inherits'),
  CommonCursor = require('../../common/cursor'),
  Doc = require('./doc');

var Cursor = function (cursor, callbackWrapper, col) {
  this._cursor = cursor;
  this._callbackWrapper = callbackWrapper;
  this._col = col;
};

inherits(Cursor, CommonCursor);

Cursor.prototype.each = function (callback) {
  var self = this;
  return new Promise(function (resolve) {
    self._callbackWrapper.callback = function (cursor) {
      if (cursor) {
        callback(new Doc(cursor.value, self._col));
        cursor.continue();
      } else {
        resolve();
      }
    };
    self._callbackWrapper.callback(self._cursor); // initial cursor already loaded
  });
};

module.exports = Cursor;
