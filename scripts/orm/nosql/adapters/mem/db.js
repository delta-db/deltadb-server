'use strict';

var Promise = require('bluebird'),
  inherits = require('inherits'),
  CommonDB = require('../../common/db'),
  Collection = require('./collection');

var DB = function (dbName, adapter) {
  this._dbName = dbName;
  this._idName = '$id'; // TODO: should every idName be moved to the DB layer?
  this._db = this; // allow a wrapping DB to be pased down to the wrapping doc
  this._adapter = adapter;
};

inherits(DB, CommonDB);

DB.prototype.col = function (name) {
  // TODO: need to store collections in array and do a lookup here before creating?
  return Promise.resolve(new Collection(name, this._db));
};

DB.prototype.close = function () {
  return Promise.resolve();
};

module.exports = DB;