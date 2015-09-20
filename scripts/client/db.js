'use strict';

// TODO: later, db should be passed in a constructor so that it doesn't have to be passed to sync??

// TODO: destroy() that sends { col: '', name: null, val: null } or something like add user role

// TODO: move some events to nosql/common layer?

var inherits = require('inherits'),
  Promise = require('bluebird'),
  utils = require('../utils'),
  MemDB = require('../orm/nosql/adapters/mem/db'),
  Doc = require('./doc'),
  Collection = require('./collection'),
  clientUtils = require('./utils');

var DB = function ( /* name, adapter */ ) {
  MemDB.apply(this, arguments); // apply parent constructor

  this._cols = {};
  this._retryAfterSecs = 180000;
  this._recorded = false;

  this._initStoreLoaded();
};

inherits(DB, MemDB);

DB.PROPS_COL_NAME = '$props';

DB.PROPS_DOC_ID = 'props';

// Use a version # to allow for patching of the store between versions when the schema changes
DB.VERSION = 1;

DB.prototype._initStoreLoaded = function () {
  // This promise ensures that the store is ready before we use it.
  this._storeLoaded = utils.once(this, 'load');
};

DB.prototype._import = function (store) {
  this._store = store;
  this._initStore();
};

DB.prototype._initStore = function () {
  var self = this,
    promises = [],
    loadingProps = false;

  self._store.all(function (colStore) {
    if (colStore._name === DB.PROPS_COL_NAME) {
      loadingProps = true;
      promises.push(self._initProps(colStore));
    } else {
      var col = self._col(colStore._name);
      col._import(colStore);
      promises.push(col._loaded);
    }
  });

  self._loaded = Promise.all(promises).then(function () {
    if (!loadingProps) { // no props? nothing in store
      return self._initProps();
    }
  }).then(function () {
    self.emit('load');
  });
};

DB.prototype._initProps = function (colStore) {
  var self = this;

  if (colStore) { // reloading?
    self._propCol = colStore;
  } else {
    self._propCol = self._store.col(DB.PROPS_COL_NAME);
  }

  return self._propCol.get(DB.PROPS_DOC_ID).then(function (doc) {
    if (doc) { // found?
      self._props = doc;
    } else {
      var props = {};
      props[self._store._idName] = DB.PROPS_DOC_ID;
      self._props = self._propCol.doc(props);
      return self._props.set({
        since: null,
        version: DB.VERSION
      });
    }
  });
};

// TODO: make sure user-defined colName doesn't start with $
// TODO: make .col() not be promise any more? Works for indexedb and mongo adapters?
DB.prototype._col = function (name, genColStore) {
  if (this._cols[name]) {
    return this._cols[name];
  } else {

    // TODO: does genColStore really need to be passed?
    var col = new Collection(name, this, genColStore);
    this._cols[name] = col;
    this._emitColCreate(col);

    return col;
  }
};

// TODO: move to col layer?? TODO: genColStore really needed??
DB.prototype._colStoreOpened = function (col, name, genColStore) {
  var self = this;
  if (genColStore) {
    return self._storeLoaded.then(function () {
      var colStore = self._store.col(name);
      col._import(colStore);
      return col;
    });
  } else {
    return Promise.resolve();
  }
};

DB.prototype.col = function (name) {
  return this._col(name, true);
};

DB.prototype._emitColCreate = function (col) {
  this.emit('col:create', col);
  this._adapter._emit('col:create', col); // also bubble up to adapter layer
};

DB.prototype._localChanges = function (retryAfter, returnSent) {
  var promises = [],
    changes = [];

  // TODO: create and use db.all() to iterate through collections
  utils.each(this._cols, function (col) {
    var promise = col._localChanges(retryAfter, returnSent).then(function (_changes) {
      changes = changes.concat(_changes);
    });
    promises.push(promise);
  });

  return Promise.all(promises).then(function () {
    return changes;
  });
};

DB.prototype._setChange = function (change) {
  var col = this.col(change.col);
  return col._setChange(change);
};

// Process changes sequentially or else duplicate collections can be created
DB.prototype._setChanges = function (changes) {
  var self = this,
    chain = Promise.resolve();
  if (!changes) {
    return chain;
  }
  changes.forEach(function (change) {
    chain = chain.then(function () {
      return self._setChange(change);
    });
  });
  return chain;
};

// TODO: rename to _sync as shouldn't be called by user
DB.prototype.sync = function (part, quorum) {
  var self = this,
    newSince = null;
  return self._localChanges(self._retryAfter).then(function (changes) {
    return part.queue(changes, quorum);
  }).then(function () {
    newSince = new Date();
    return self._loaded; // ensure props have been loaded/created first
  }).then(function () {
    return self._props.get();
  }).then(function (props) {
    return part.changes(props.since);
  }).then(function (changes) {
    return self._setChanges(changes);
  }).then(function () {
    return self._props.set({
      since: newSince
    });
  });
};

DB.prototype._emit = function () { // event, arg1, ... argN
  var args = utils.toArgsArray(arguments);
  this.emit.apply(this, args);
  this._adapter._emit.apply(this._adapter, args); // also bubble up to adapter layer

  if (!this._recorded && args[0] === 'attr:record') { // not recorded yet?
    this.emit('db:record', this);
    this._adapter._emit('db:record', this); // also bubble up to adapter layer
    this._recorded = true;
  }
};

DB.prototype.policy = function (colName, policy) {
  // Find/create collection and set policy for new doc
  var col = this.col(colName);
  return col.policy(policy);
};

DB.prototype.createUser = function (userUUID, username, password, status) {
  var col = this.col(Doc._userName);
  return col._createUser(userUUID, username, password, status);
};

DB.prototype.updateUser = function (userUUID, username, password, status) {
  return this.createUser(userUUID, username, password, status);
};

DB.prototype.addRole = function (userUUID, roleName) {
  var colName = clientUtils.NAME_PRE_USER_ROLES + userUUID;
  var col = this.col(colName);
  return col._addRole(userUUID, roleName);
};

DB.prototype.removeRole = function (userUUID, roleName) {
  var colName = clientUtils.NAME_PRE_USER_ROLES + userUUID;
  var col = this.col(colName);
  return col._removeRole(userUUID, roleName);
};

module.exports = DB;