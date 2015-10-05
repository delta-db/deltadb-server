'use strict';

// TODO: later, db should be passed in a constructor so that it doesn't have to be passed to sync??

// TODO: move some events to nosql/common layer?

// TODO: separate out socket.io code?

var inherits = require('inherits'),
  Promise = require('bluebird'),
  utils = require('../utils'),
  MemDB = require('../orm/nosql/adapters/mem/db'),
  Doc = require('./doc'),
  Collection = require('./collection'),
  clientUtils = require('./utils'),
  io = require('socket.io-client'),
  Sender = require('./sender'),
  log = require('../utils/log'),
  DBMissingError = require('./db-missing-error');

var DB = function ( /* name, adapter */ ) {

this._dbg = Math.random(); // TODO: remove

  this._id = Math.floor(Math.random() * 10000000); // used to debug multiple connections

  MemDB.apply(this, arguments); // apply parent constructor

  this._cols = {};
  this._retryAfterMSecs = 180000;
  this._recorded = false;
  this._sender = new Sender(this);
  this._url = 'http://localhost:3000'; // TODO: make this configurable

  this._initStoreLoaded();

  this._connectWhenReady();

  this._loadStore();
};

inherits(DB, MemDB);

DB.PROPS_COL_NAME = '$props';

DB.PROPS_DOC_ID = 'props';

// Use a version # to allow for patching of the store between versions when the schema changes
DB.VERSION = 1;

DB.prototype._loadStore = function () {
  this._adapter._initDBStore(this);
};

DB.prototype._initStoreLoaded = function () {
  // This promise ensures that the store is ready before we use it.
  this._storeLoaded = utils.once(this, 'load'); // TODO: are _storeLoaded and _loaded both needed?
};

// TODO: can this be cleaned up? Do we really need _storeLoaded, _loaded and _ready?
DB.prototype._ready = function () {
  var self = this;
  return self._storeLoaded.then(function () {
    return self._loaded;
  });
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
console.log('DB.prototype._setChange, col._name=', col._name);
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
  return self._localChanges(self._retryAfterMSecs).then(function (changes) {
    return part.queue(changes, quorum);
  }).then(function () {
    newSince = new Date();
    return self._loaded; // ensure props have been loaded/created first
  }).then(function () {
    return part.changes(self._props.since);
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

DB.prototype._createDatabase = function (dbName) {
  var colName = clientUtils.DB_COLLECTION_NAME;
  var col = this.col(colName);
  return col._createDatabase(dbName);
};

DB.prototype._destroyDatabase = function (dbName) {
  var colName = clientUtils.DB_COLLECTION_NAME;
  var col = this.col(colName);
  return col._destroyDatabase(dbName);
};

DB.prototype.destroy = function () {
  return this._adapter._destroyDatabase(this._name);
};

DB.prototype._emitInit = function () {
  var self = this;
  return self._ready().then(function () { // ensure props have been loaded/created first
    var msg = {
      db: self._name,
      since: self._props.since
    };
    log.info(self._id + ' sending init ' + JSON.stringify(msg));
    self._socket.emit('init', msg);
  });
};

DB.prototype._emitChanges = function (changes) {
  var msg = {
    changes: changes
  };
  log.info(this._id + ' sending ' + JSON.stringify(msg));
  this._socket.emit('changes', msg);
};

// TODO: it appears that the local changes don't get cleared until they are recorded, which is
// correct, but investigate further to make sure that changes won't be duplicated back and forth.
DB.prototype._findAndEmitChanges = function () {
  // TODO: what happens if there are client changes and we are offline, does _emitChanges fail? Do
  // we need a _connected flag to determine whether to skip the following?

  // TODO: keep sync and this fn so that can test w/o socket, right? If so, then better way to reuse
  // code?
  var self = this;

  return self._ready().then(function () { // ensure props have been loaded/created first
    return self._localChanges(self._retryAfterMSecs);
  }).then(function (changes) {
    if (changes.length > 0) {
      self._emitChanges(changes);
    }
  });

};

DB.prototype._processChanges = function (msg) {
console.log('DB.prototype._processChanges, db._dbg=', this._dbg, 'msg=', msg);
  var self = this;
  log.info(self._id + ' received ' + JSON.stringify(msg));
  return self._ready().then(function () { // ensure props have been loaded/created first
    return self._setChanges(msg.changes); // Process the server's changes
  }).then(function () {
    return self._props.set({ // Update since
      since: msg.since
    });
  });
};

DB.prototype._registerChangesListener = function () {
  var self = this;
  self._socket.on('changes', function (msg) {
    self._processChanges(msg);
  });
};

DB.prototype._registerSenderListener = function () {
  var self = this;
  self.on('change', function () {
    self._sender.send();
  });
};

DB.prototype._registerDisconnectListener = function () {
  var self = this;
  self._socket.on('disconnect', function () {
    log.info(self._id + ' server disconnected');
    self.emit('disconnect');
  });
};

DB.prototype._createDatabaseAndInit = function () {
  var self = this;
  return self._adapter._createDatabase(self._name).then(function () {
    return self._init();
  });
};

DB.prototype._registerErrorListener = function () {
  var self = this;
  self._socket.on('delta-error', function (err) {
    log.warning(self._id + ' err=' + err.message);

    if (err.name === 'DBMissingError') {
      log.info(self._id + ' creating DB ' + self._name);
      self._createDatabaseAndInit();
    } else {
      throw err;
    }
  });
};

DB.prototype._init = function () {
  var self = this;

  self._emitInit();

  // Server currently requires init-done before it will start listening to changes
  self._socket.on('init-done', function () {
    log.info(self._id + ' received init-done');
    self._sender.send();
  });
};

DB.prototype._connect = function () {
  var self = this;

  self._socket = io.connect(self._url,
    {
      'force new connection': true
    }); // same client, multiple connections for testing

  self._registerErrorListener();

  self._registerDisconnectListener();

  self._registerChangesListener();

  self._registerSenderListener();

  self._socket.on('connect', function () {
    self._init();
  });

};

DB.prototype._disconnect = function () {
  var promise = utils.once(this, 'disconnect');
  this._socket.disconnect();
  return promise;
};

DB.prototype._connectWhenReady = function () {
  var self = this;
  return self._storeLoaded.then(function () {
    if (!self._adapter._localOnly) {
      return self._connect();
    }
  });
};

module.exports = DB;