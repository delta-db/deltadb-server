'use strict';

var inherits = require('inherits'),
  CommonAdapter = require('../../common/adapter'),
  DB = require('./db');

var Adapter = function () {
  CommonAdapter.apply(this, arguments); // apply parent constructor
  this._dbs = {};
};

inherits(Adapter, CommonAdapter);

// opts: db
Adapter.prototype.db = function (opts) {
  if (this._dbs[opts.db]) { // exists?
    return this._dbs[opts.db];
  } else {
    var db = new DB(opts.db, this);
    this._dbs[opts.db] = db;
    return db;
  }
};

// Note: not used, but may be used in the future
// TODO: should this return a promise like col.all()??
// Adapter.prototype.all = function (callback) {
//   utils.each(this._dbs, callback);
// };

// Adapter.prototype.exists = function (dbName) {
//   return this._dbs[dbName] ? true : false;
// };

Adapter.prototype._unregister = function (dbName) {
  delete this._dbs[dbName];
};

module.exports = Adapter;
