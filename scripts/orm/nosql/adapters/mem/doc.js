'use strict';

var Promise = require('bluebird'),
  inherits = require('inherits'),
  utils = require('../../../../utils'),
  AbstractDoc = require('../../common/doc');

var Doc = function (doc, collection) {
  AbstractDoc.apply(this, arguments); // apply parent constructor
  this._collection = collection;
  this._idName = collection._db._idName;
};

inherits(Doc, AbstractDoc);

Doc.prototype._insert = function () {
  // if (!this.id()) { // TODO: is id ever null?
  this.id(utils.uuid());
  //  this._collection._register(this);
  // }
  // TODO: should we clear the id if there is an error?
  return Promise.resolve();
};

Doc.prototype._update = function () {
  return Promise.resolve();
};

Doc.prototype._save = function () {
  var self = this,
    promise = self.id() ? self._update() : self._insert();
  return promise.then(function () {
    self.clean();
  });
};

// TODO: keep?
// Doc.prototype.merge = function () {
//   var self = this,
//     promise = self.id() ? self._update() : self._insert();
//   return promise.then(function () {
//     self.clean();
//   });
// };

Doc.prototype._destroy = function () {
  // TODO: move _unregister to item-common like register
  this._collection._unregister(this);
  return Promise.resolve();
};

module.exports = Doc;