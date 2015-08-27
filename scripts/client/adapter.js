'use strict';

// TODO: should events be moved to nosql/common layer?

var inherits = require('inherits'),
  MemAdapter = require('../orm/nosql/adapters/mem/adapter'),
  DB = require('./db'),
  utils = require('../utils'),
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
  var self = this;
  self._loaded = self._store._load().then(function () {
    var promises = [];
    self._store.all(function (dbStore) {
      var db = self.db({
        db: dbStore._name
      });
      db._import(dbStore);
      promises.push(db._loaded);
    });
    return Promise.all(promises).then(function () {
      self._emit('load');
    });
  });
};

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

    db._import(this._store.db(opts));

    return db;
  }
};

module.exports = Adapter;