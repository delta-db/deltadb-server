'use strict';

// TODO: should events be moved to nosql/common layer?

var inherits = require('inherits'),
  MemAdapter = require('../orm/nosql/adapters/mem/adapter'),
  DB = require('./db'),
  utils = require('../utils'),
  clientUtils = require('./utils'),
  Promise = require('bluebird');

var Adapter = function (store) {
  MemAdapter.apply(this, arguments); // apply parent constructor

  this._store = store;
  this._initStore();
};

// We inherit from MemAdapter so that we can have singular references in memory to items like Docs.
// This in turn allows us to emit and listen for events across different modules. The downside is
// that we end up with data duplicated in both local mem and the store.

inherits(Adapter, MemAdapter);

Adapter.prototype._initStore = function () {
  this._loaded = this._store._load();
};

Adapter.prototype._initDBStore = function (db) {
  var self = this;
  self._loaded.then(function () {
    var dbStore = self._store.db({ db: db._name }); // get or create store
    db._import(dbStore);
  });
};

// TODO: remove as handled at db layer now
// Adapter.prototype._createMissingStores = function () {
//   // Resolves after all the missing stores have loaded
//   var self = this,
//     promises = [];
//   self.all(function (db) {
//     if (!db._store) { // store hasn't been reloaded?
//       db._import(self._store.db({
//         db: db._name
//       }));
//       promises.push(db._loaded);
//     }
//   });
//   return Promise.all(promises);
// };

// TODO: remove as handled at db layer now
// Adapter.prototype._initStore = function () {
//   var self = this;
//   self._loaded = self._store._load().then(function () {
//     var promises = [];

//     self._store.all(function (dbStore) {
//       var db = self.db({
//         db: dbStore._name
//       });
//       db._import(dbStore);
//       promises.push(db._loaded);
//     });

//     return Promise.all(promises).then(function () {
//       // Create missing stores after all the existing stores have been loaded so that we don't have
//       // a race condition where we are trying to create a store that is also being reloaded
//       return self._createMissingStores();
//     }).then(function () {
//       self._emit('load');
//     });
//   });
// };

Adapter.prototype._emit = function () { // event, arg1, ... argN
  this.emit.apply(this, utils.toArgsArray(arguments));
};

Adapter.prototype.uuid = function () {
  return utils.uuid();
};

// TODO: refactor to db(name) and also modify common
// opts: db
Adapter.prototype.db = function (opts) {
  var db = this._dbs[opts.db];
  if (db) { // exists?
    return db;
  } else {
    db = new DB(opts.db, this);
    this._dbs[opts.db] = db;
    this.emit('db:create', db);
    return db;
  }
};

Adapter.prototype._systemDB = function () {
  if (!this._sysDB) {
    this._sysDB = this.db({ db: clientUtils.SYSTEM_DB_NAME }); // TODO: pass url here
  }
  return this._sysDB;
};

Adapter.prototype._createDatabase = function (dbName) {
  var self = this;
  return self._systemDB()._createDatabase(dbName).then(function (doc) {
    return new Promise(function (resolve) {
      doc.on('attr:record', function (attr) {
// TODO: why is the attr value not dbName???
console.log('attr:record, dbName=', dbName, 'attr=', attr);
        if (attr.value === dbName) { // db was created
          resolve();
        }
      });
    });
  });
};

Adapter.prototype._destroyDatabase = function (dbName) {
  var self = this;
console.log('Adapter.prototype._destroyDatabase ', dbName);

  // If the db exists then close it first!! I don't think we have to worry about a race condition
  // where the client re-creates this DB while trying to destroy as the destroy will just fail as
  // the db is in use and will be retried later.
  if (this.exists(dbName)) {
console.log('disconnect ', dbName);
    // TODO: really need a get so that URL doesn't need to be specified here?
    var db = this.db({ db: dbName });

    db._disconnect();
  }

  return self._systemDB()._destroyDatabase(dbName).then(function (doc) {
    return new Promise(function (resolve) {
      doc.on('attr:record', function (attr) {
console.log('attr:record, dbName=', dbName, 'attr=', attr);
        if (attr.value === null) { // db was destroyed
          resolve();
        }
      });
    });
  });
};

module.exports = Adapter;