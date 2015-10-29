'use strict';

var inherits = require('inherits'),
  CommonAdapter = require('../../common/adapter'),
  DB = require('./db'),
  Promise = require('bluebird');

var Adapter = function () {
  CommonAdapter.apply(this, arguments); // apply parent constructor
  this._dbs = {};
};

inherits(Adapter, CommonAdapter);

// opts: db
Adapter.prototype.db = function (opts) {
  var name = opts.db;
  if (!this._dbs[name]) {
    this._dbs[name] = new DB(name, this);
  }
  return this._dbs[name];
};

Adapter.prototype._unregister = function (name) {
  delete this._dbs[name];
  return Promise.resolve();
};

module.exports = Adapter;
