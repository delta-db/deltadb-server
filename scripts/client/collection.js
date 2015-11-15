'use strict';

var inherits = require('inherits'),
  Promise = require('bluebird'),
  MemCollection = require('../orm/nosql/adapters/mem/collection'),
  utils = require('../utils'),
  clientUtils = require('./utils'),
  Doc = require('./doc'),
  Cursor = require('../orm/nosql/adapters/mem/cursor');

var Collection = function ( /* name, db */ ) {
  MemCollection.apply(this, arguments); // apply parent constructor
  this._initLoaded();
};

inherits(Collection, MemCollection);

Collection.prototype._initLoaded = function () {
  var self = this;
  self._loaded = utils.once(self, 'load');
};

Collection.prototype._import = function (store) {
  this._store = store;
  this._initStore();
};

Collection.prototype._createStore = function () {
  this._store = this._db._store.col(this._name);
};

Collection.prototype._ensureStore = function () {
  var self = this;
  // Wait until db is loaded and then create store. We don't need to return _loaded as this
  // _ensureStore() is called by the doc which will create the doc store afterwards and then emit
  // the 'load'
  return self._db._loaded.then(function () {
    self._createStore();
    return null; // prevent runaway promise warnings
  });
};

Collection.prototype._doc = function (data) {
  var id = data ? data[this._db._idName] : utils.uuid();

  if (!this._docs[id]) { // not registered?
// TODO: use a reg fn instead?
    this._docs[id] = new Doc(data, this);
  }

  return this._docs[id];
};

Collection.prototype.doc = function (data) {
  return this._doc(data, true);
};

Collection.prototype._initStore = function () {
  var self = this,
    promises = [];

  var all = self._store.all(function (docStore) {
    var data = {};
    data[self._db._idName] = docStore.id();
    var doc = self._doc(data);
    doc._import(docStore);
    promises.push(doc._loaded);
  });

  // all resolves when we have executed the callback for all docs and Promise.all(promises) resolves
  // after all the docs have been loaded. We need to wait for all first so that we have promises
  // set.
  self._loaded = all.then(function () {
    return Promise.all(promises);
  }).then(function () {
    self.emit('load');
    return null; // prevent runaway promise warning
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
  // We need to notify the DB of the change as it isn't until the doc is registered that the DB
  // can gather the changes. The sender will throttle any back-to-back change emissions.
  doc._emitChange();

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
  var self = this,
    id = clientUtils.toDocUUID(userUUID);
  return self.get(id).then(function (doc) {
    // If we are updating the user, the doc may already exist
    if (!doc) { // doc missing?
      doc = self.doc();
      doc.id(id);
    }
    return doc._createUser(userUUID, username, password, status);
  });
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

module.exports = Collection;
