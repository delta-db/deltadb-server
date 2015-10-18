'use strict';

var Promise = require('bluebird'),
  inherits = require('inherits'),
  Cursor = require('./index');

var ArrayCursor = function (docs) {
  this._docs = docs;
};

inherits(ArrayCursor, Cursor);

ArrayCursor.prototype.each = function (callback) {
  var self = this;
  return new Promise(function (resolve) {
    self._docs.forEach(function (doc) {
      callback(doc);
    });
    resolve();
  });
};

module.exports = ArrayCursor;
