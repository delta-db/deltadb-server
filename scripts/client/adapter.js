'use strict';

// TODO: should events be moved to nosql/common layer?

var inherits = require('inherits'),
  CommonAdapter = require('../orm/nosql/common/adapter'),
  DB = require('./db'),
  utils = require('../utils');

var Adapter = function (store) {
  CommonAdapter.apply(this, arguments); // apply parent constructor
  this._store = store;
};

inherits(Adapter, CommonAdapter);

Adapter.prototype._emit = function () { // event, arg1, ... argN
  this.emit.apply(this, utils.toArgsArray(arguments));
};

Adapter.prototype.uuid = function () {
  return utils.uuid();
};

// opts: db
Adapter.prototype.db = function (opts) {
  var dbStore = this._store.db(opts);
  var db = new DB(opts.db, this, dbStore);
  this.emit('db:create', db);
  return db;
};

module.exports = Adapter;