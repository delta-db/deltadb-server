'use strict';

var Promise = require('bluebird'),
  inherits = require('inherits'),
  utils = require('../../../../utils'),
  AbstractItem = require('../../common/item');

var Item = function (doc, collection) {
  AbstractItem.apply(this, arguments); // apply parent constructor
  this._collection = collection;
  this._idName = collection._db._idName;
};

inherits(Item, AbstractItem);

Item.prototype._insert = function () {
  // if (!this.id()) { // TODO: is id ever null?
  this.id(utils.uuid());
  //  this._collection._register(this);
  // }
  // TODO: should we clear the id if there is an error?
  return Promise.resolve();
};

Item.prototype._update = function () {
  return Promise.resolve();
};

Item.prototype._save = function () {
  var self = this,
    promise = self.id() ? self._update() : self._insert();
  return promise.then(function () {
    self.clean();
  });
};

// TODO: keep?
// Item.prototype.merge = function () {
//   var self = this,
//     promise = self.id() ? self._update() : self._insert();
//   return promise.then(function () {
//     self.clean();
//   });
// };

Item.prototype._destroy = function () {
  // TODO: move _unregister to item-common like register
  this._collection._unregister(this);
  return Promise.resolve();
};

module.exports = Item;