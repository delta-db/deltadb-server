'use strict';

var Promise = require('bluebird'),
  inherits = require('inherits'),
  AbstractCursor = require('../../common/cursor'),
  utils = require('../../../../utils');

var Cursor = function (docs, collection) {
  this._docs = docs;
  this._collection = collection; // TODO: destroy?
};

inherits(Cursor, AbstractCursor);

Cursor.prototype.each = function (callback) {
  var self = this;
  return new Promise(function (resolve) {
    utils.each(self._docs, function (doc) {
      if (doc._include()) {
        callback(doc);
      }
    });
    resolve();
  });
};

module.exports = Cursor;