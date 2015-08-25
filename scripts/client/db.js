'use strict';

// TODO: later db should be passed in a constructor so that it doesn't have to be passed to sync??

// TODO: destroy() that sends { col: '', name: null, val: null } or something like add user role

// TODO: move events to nosql/common layer?

var inherits = require('inherits'),
  Promise = require('bluebird'),
  utils = require('../utils'),
  MemDB = require('../orm/nosql/adapters/mem/db'),
  Doc = require('./doc'),
  Collection = require('./collection'),
  clientUtils = require('./utils');

var DB = function (name, adapter, store) {
  MemDB.apply(this, arguments); // apply parent constructor
  
  this._store = store;
  this._initStore();

  this._collections = {};
  this._since = null; // TODO: persist w/ some local store for globals
  this._retryAfterSecs = 180000;
  this._recorded = false;

  this._propsReady = this._initProps();
};

inherits(DB, MemDB);

DB.PROPS_COL_NAME = '$props';

DB.PROPS_DOC_ID = 'props';

DB.prototype._initStore = function () {
  var self = this;
  self._store.all(function (colStore) {
    if (colStore._name !== DB.PROPS_COL_NAME) {
      // PROPS_COL_NAME handled by _initProps
      self._col(colStore._name, colStore);
    }
  });
};

DB.prototype._initProps = function () {
  var self = this;
  return self._store.col(DB.PROPS_COL_NAME).then(function (col) {
    self._propCol = col;
    self._propCol.get(DB.PROPS_DOC_ID).then(function (doc) {
      if (doc) { // found?
        self._props = doc;
      } else {
        var props = {};
        props[self._store._idName] = DB.PROPS_DOC_ID;
        self._props = self._propCol.doc(props);
        return self._props.set({
          since: null
        });
      }
    });
  });
};

// TODO: make sure user-defined colName doesn't start with $
// TODO: make .col() not be promise any more? Works for indexedb and mongo adapters?
DB.prototype._col = function (name, colStore) {
  var self = this;
  return new Promise(function (resolve) {
    if (self._collections[name]) {
      resolve(self._collections[name]);
    } else {
      var promise = null;
      if (colStore) {
        promise = Promise.resolve(colStore);
      } else {
        promise = self._store.col(name);
      }

      var ret = promise.then(function (colStore) {
        var collection = new Collection(name, self, colStore);
        self._collections[name] = collection;
        self._emitColCreate(collection);
        return collection;
      });
      resolve(ret);
    }
  });
};

DB.prototype.col = function (name) {
  return this._col(name);
};

DB.prototype._emitColCreate = function (col) {
  this.emit('col:create', col);
  this._adapter._emit('col:create', col); // also bubble up to adapter layer
};

DB.prototype._localChanges = function (retryAfter, returnSent) {
  var promises = [],
    changes = [];

  // TODO: create and use db.all() to iterate through collections
  utils.each(this._collections, function (collection) {
    var promise = collection._localChanges(retryAfter, returnSent).then(function (_changes) {
      changes = changes.concat(_changes);
    });
    promises.push(promise);
  });

  return Promise.all(promises).then(function () {
    return changes;
  });
};

DB.prototype._setChange = function (change) {
  return this.col(change.col).then(function (collection) {
    return collection._setChange(change);
  });
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
    return self._propsReady; // ensure props have been loaded/created first
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
  return this.col(colName).then(function (col) {
    return col.policy(policy);
  });
};

DB.prototype.createUser = function (userUUID, username, password, status) {
  return this.col(Doc._userName).then(function (col) {
    return col._createUser(userUUID, username, password, status);
  });
};

DB.prototype.updateUser = function (userUUID, username, password, status) {
  return this.createUser(userUUID, username, password, status);
};

DB.prototype.addRole = function (userUUID, roleName) {
  var colName = clientUtils.NAME_PRE_USER_ROLES + userUUID;
  return this.col(colName).then(function (col) {
    return col._addRole(userUUID, roleName);
  });
};

DB.prototype.removeRole = function (userUUID, roleName) {
  var colName = clientUtils.NAME_PRE_USER_ROLES + userUUID;
  return this.col(colName).then(function (col) {
    return col._removeRole(userUUID, roleName);
  });
};

module.exports = DB;