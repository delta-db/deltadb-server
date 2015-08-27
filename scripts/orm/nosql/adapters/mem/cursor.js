'use strict';

var Promise = require('bluebird'),
  inherits = require('inherits'),
  CommonCursor = require('../../common/cursor'),
  utils = require('../../../../utils');

var Cursor = function (docs, collection, all) {
  this._docs = docs;
  this._collection = collection; // TODO: remove?
  this._all = all;
};

inherits(Cursor, CommonCursor);

Cursor.prototype.each = function (callback) {
  var self = this;
  return new Promise(function (resolve) {
    utils.each(self._docs, function (doc) {
      if (self._all || doc._include()) {
        callback(doc);
      }
    });
    resolve();
  });
};

module.exports = Cursor;