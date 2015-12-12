'use strict';

var Promise = require('bluebird'),
  inherits = require('inherits'),
  CommonCursor = require('../../common/cursor'),
  utils = require('deltadb-common-utils');

var Cursor = function (docs, col, all) {
  this._docs = docs;
  this._col = col; // TODO: remove?
  this._all = all;
};

inherits(Cursor, CommonCursor);

Cursor.prototype.each = function (callback) {
  var self = this;
  return new Promise(function (resolve) {
    utils.each(self._docs, function (doc) {
      if (self._all || doc._include()) {
        // Return value so that each loop can be ended early
        return callback(doc);
      }
    });
    resolve();
  });
};

module.exports = Cursor;
