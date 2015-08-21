'use strict';

// TODO: items/changes need to be in store (i.e. separate instance of orm) so that they can be
// persistent

var inherits = require('inherits'),
  Promise = require('bluebird'),
  CollectionWrapper = require('../orm/nosql/wrapper/collection'),
  utils = require('../utils'),
  clientUtils = require('./utils');

var Collection = function () {
  CollectionWrapper.apply(this, arguments); // apply parent constructor
};

inherits(Collection, CollectionWrapper);

Collection.prototype._setChange = function (change) {
  var item = this._getDoc(change.id),
    promise = null;
  if (!item) {
    item = this.doc();
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

  if (evnt === 'doc:record') {
    this._emit.apply(this, ['col:record', this]);
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

Collection.prototype.policy = function (policy) {
  var item = this.doc();
  return item.policy(policy);
};

// Shouldn't be called directly as the colName needs to be set properly
Collection.prototype._createUser = function (userUUID, username, password, status) {
  var doc = this.doc();
  doc.id(clientUtils.toDocUUID(userUUID));
  return doc._createUser(userUUID, username, password, status);
};

Collection.prototype._addRole = function (userUUID, roleName) {
  var doc = this.doc();
  return doc._addRole(userUUID, roleName);
};

Collection.prototype._removeRole = function (userUUID, roleName) {
  var doc = this.doc();
  return doc._removeRole(userUUID, roleName);
};

module.exports = Collection;