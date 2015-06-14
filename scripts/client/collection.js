'use strict';

// TODO: items/changes need to be in store (i.e. separate instance of orm) so that they can be
// persistent

var inherits = require('inherits'),
  Promise = require('bluebird'),
  CollectionWrapper = require('../orm/nosql/wrapper/collection');

var Collection = function () {
  CollectionWrapper.apply(this, arguments); // apply parent constructor
};

inherits(Collection, CollectionWrapper);

Collection.prototype._setChange = function (change) {
  var item = this._getItem(change.id),
    promise = null;
  if (!item) {
    item = this.define();
    item.id(change.id);
    promise = this._register(item);
  } else {
    promise = Promise.resolve();
  }
  // TODO: in future, if sequence of changes for same doc then set for all changes and then issue a
  // single save?
  return promise.then(function () {
    return item._setChange(change);
  });
};

Collection.prototype._emit = function (event, attr, item) {
  this.emit(event, attr, item);
  this._db._emit(event, attr, item); // also bubble up to db layer
};

Collection.prototype._register = function (item) {
  var self = this;
  return self._collection._register.apply(this, arguments).then(function () {
    item._emitDocCreate();
  });
};

module.exports = Collection;