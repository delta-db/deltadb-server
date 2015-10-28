'use strict';

// TODO: should events be moved to nosql/common layer?

var inherits = require('inherits'),
  MemAdapter = require('../orm/nosql/adapters/mem/adapter'),
  DB = require('./db'),
  utils = require('../utils'),
  clientUtils = require('./utils'),
  Promise = require('bluebird'),
  adapterStore = require('./adapter-store');

var Adapter = function (localOnly) {
  MemAdapter.apply(this, arguments); // apply parent constructor
  this._localOnly = localOnly;
};

// We inherit from MemAdapter so that we can have singular references in memory to items like Docs.
// This in turn allows us to emit and listen for events across different modules. The downside is
// that we end up with data duplicated in both local mem and the store.

inherits(Adapter, MemAdapter);

Adapter.prototype._emit = function () { // event, arg1, ... argN
  this.emit.apply(this, utils.toArgsArray(arguments));
};

Adapter.prototype.uuid = function () {
  return utils.uuid();
};

Adapter.prototype._adapterStore = function () {
  return adapterStore.newAdapter();
};

Adapter.prototype._dbStore = function (name) {
  var adapterStore = this._adapterStore();
  return adapterStore.db({
    db: name
  });
};

Adapter.prototype.db = function (opts) {
  var db = this._dbs[opts.db];
  if (db) { // exists?
    return db;
  } else {

    if (typeof opts.local === 'undefined') {
      //    if (typeof opts.local === 'undefined' && typeof this._localOnly !== 'undefined') {
      opts.local = this._localOnly;
    }

    var dbStore = null;
    if (typeof opts.store === 'undefined') {
      dbStore = this._dbStore(opts.db);
    } else {
      dbStore = opts.store;
    }

    db = new DB(opts.db, this, opts.url, opts.local);
    db._import(dbStore);
    this._dbs[opts.db] = db;
    this.emit('db:create', db);
    return db;
  }
};

Adapter.prototype._systemDB = function () {
  if (!this._sysDB) {
    this._sysDB = this.db({
      db: clientUtils.SYSTEM_DB_NAME
    }); // TODO: pass url here
  }
  return this._sysDB;
};

Adapter.prototype._resolveAfterDatabaseCreated = function (dbName, originatingDoc, ts) {
  return new Promise(function (resolve) {
    // When creating a DB, the delta is id-less and so that cannot use an id to reconcile the
    // local doc. Instead we listen for a new doc on the parent collection and then delete the
    // local doc that was used to originate the delta so that we don't attempt to create the DB
    // again. TODO: Another option for the future could be to create an id in the doc that
    // corresponds to the creating delta id.
    originatingDoc._col.on('doc:create', function (doc) {
      var data = doc.get();
      // There could have been DBs with the same name created before so we need to check the
      // timestamp

      if (data[clientUtils.DB_ATTR_NAME] && data[clientUtils.DB_ATTR_NAME] === dbName &&
        doc._dat.recordedAt.getTime() >= ts.getTime()) {
        resolve(originatingDoc._destroyLocally());
      }
    });
  });
};

Adapter.prototype._createDatabase = function (dbName) {
  var self = this,
    ts = new Date();
  return self._systemDB()._createDatabase(dbName).then(function (doc) {
    return self._resolveAfterDatabaseCreated(dbName, doc, ts);
  });
};

Adapter.prototype._resolveAfterDatabaseDestroyed = function (dbName, originatingDoc, ts) {
  return new Promise(function (resolve) {
    // When creating a DB, the delta is id-less and so we cannot use an id to reconcile the local
    // doc. Instead we listen for a doc:destroy event on the parent collection and then delete the
    // local doc that was used to originate the delta so that we don't attempt to destroy the DB
    // again. TODO: Another option for the future could be to create an id in the doc that
    // corresponds to the destroying delta id.
    originatingDoc._col.on('doc:destroy', function (doc) {
      var data = doc.get();
      // TODO: only using istanbul ignore here as assuming that this code will be replaced when we
      // create a new construct for creating/destroy DBs, users, etc... If this code remains then
      // remove this istanbul annotation and test!
      /* istanbul ignore next */
      if (data[clientUtils.DB_ATTR_NAME] && data[clientUtils.DB_ATTR_NAME] === dbName &&
        doc._dat.destroyedAt.getTime() >= ts.getTime()) {
        // There could have been DBs with the same name destroyed before so we need to check the
        // timestamp
        resolve(originatingDoc._destroyLocally());
      }
    });
  });
};

Adapter.prototype._unregister = function (dbName) {
  delete this._dbs[dbName];
  return Promise.resolve();
};

Adapter.prototype._destroyDatabase = function (dbName) {
  var self = this, ts = new Date();
  return self._systemDB()._destroyDatabase(dbName).then(function (doc) {
    return self._resolveAfterDatabaseDestroyed(dbName, doc, ts);
  });
};

module.exports = Adapter;
