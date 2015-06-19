'use strict';

// TODO: items/changes need to be in store (i.e. separate instance of orm) so that they can be
// persistent

var inherits = require('inherits'),
  Promise = require('bluebird'),
  CollectionWrapper = require('../orm/nosql/wrapper/collection'),
  utils = require('../utils');

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

Collection.prototype._emit = function (evnt) { // evnt, arg1, ... argN
  var args = utils.toArgsArray(arguments);
  this.emit.apply(this, args);

  this._db._emit.apply(this._db, args); // also bubble up to db layer

  // Prevent infinite recursion
  if (evnt !== 'col:create' && evnt !== 'col:update') {
    this._emit.apply(this, ['col:update', this]);
  }
};

Collection.prototype._emitColDestroy = function () {
  this._emit('col:destroy', this);
};

Collection.prototype._register = function (item) {
  return this._collection._register.apply(this, arguments).then(function () {
    item._emitDocCreate();
  });
};

Collection.prototype.destroy = function () {
  var self = this;
  return self._collection.destroy.apply(this, arguments).then(function () {
    self._emitColDestroy();
  });
};

module.exports = Collection;