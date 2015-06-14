'use strict';

var Promise = require('bluebird'),
  inherits = require('inherits'),
  AbstractCursor = require('../../common/cursor'),
  utils = require('../../../../utils');

var Cursor = function (items, collection) {
  this._items = items;
  this._collection = collection; // TODO: destroy?
};

inherits(Cursor, AbstractCursor);

Cursor.prototype.each = function (callback) {
  var self = this;
  return new Promise(function (resolve) {
    utils.each(self._items, function (item) {
      if (item._include()) {
        callback(item);
      }
    });
    resolve();
  });
};

module.exports = Cursor;