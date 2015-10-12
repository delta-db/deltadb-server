'use strict';

var inherits = require('inherits'),
  Promise = require('bluebird'),
  MemCollection = require('../orm/nosql/adapters/mem/collection'),
  utils = require('../utils'),
  clientUtils = require('./utils'),
  Doc = require('./doc'),
  Cursor = require('../orm/nosql/adapters/mem/cursor');

var Collection = function (name, db, genColStore) {
  MemCollection.apply(this, arguments); // apply parent constructor
  this._genColStore = genColStore; // TODO: really needed??
};

inherits(Collection, MemCollection);

Collection.prototype._import = function (store) {
  this._store = store;
  this._initStore();
};

Collection.prototype._doc = function (data, genDocStore) {
  var id = data ? data[this._db._idName] : null;
  if (id && this._docs[id]) { // has id and exists?
    // TODO: need to set data here??
    return this._docs[id];
  } else {
    var doc = new Doc(data, this, genDocStore);

    // In most cases we don't know the id when creating the doc and rely on save() to call
    // register() later

    // We need the store to be setup before changing the data
    if (genDocStore && data) {
      doc._changeDoc(data);
    }

    return doc;
  }
};

Collection.prototype.doc = function (data) {
  return this._doc(data, true);
};

Collection.prototype._initStore = function () {
  var self = this;
  self._loaded = self._store.all(function (docStore) {
    var doc = self._doc();
    doc._import(docStore);
  }).then(function () {
    self.emit('load');
  });
};

Collection.prototype._setChange = function (change) {
  var self = this,
    doc = null;
  return self.get(change.id).then(function (_doc) {
    doc = _doc;
    if (!doc) {
      doc = self.doc();
      doc.id(change.id);
    }
  }).then(function () {
    // TODO: in future, if sequence of changes for same doc then set for all changes and then issue
    // a single save?
    return doc._setChange(change);
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

Collection.prototype._register = function (doc) {
  doc._emitDocCreate();
  return MemCollection.prototype._register.apply(this, arguments);
};

Collection.prototype.destroy = function () {
  // Don't actually destroy the col as we need to keep tombstones
  this._emitColDestroy(); // TODO: move to common
  return Promise.resolve();
};

Collection.prototype.policy = function (policy) {
  var doc = this.doc();
  return doc.policy(policy);
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

Collection.prototype._createDatabase = function (dbName) {
  return this.doc()._createDatabase(dbName);
};

Collection.prototype._destroyDatabase = function (dbName) {
  return this.doc()._destroyDatabase(dbName);
};

Collection.prototype.find = function (query, callback, destroyed) {
  return this._find(query, callback, new Cursor(this._docs, this, destroyed));
};

Collection.prototype._localChanges = function (retryAfter, returnSent) {
  var changes = [];
  return this.find(null, function (doc) {
    changes = changes.concat(doc._localChanges(retryAfter, returnSent));
  }, true).then(function () {
    return changes;
  });
};

Collection.prototype._open = function () {
  return this._db._colStoreOpened(this, this._name, this._genColStore);
};

Collection.prototype._opened = function () {
  if (!this._openPromise) {
    this._openPromise = this._open();
  }
  return this._openPromise;
};

module.exports = Collection;
