'use strict';

var Promise = require('bluebird'),
  inherits = require('inherits'),
  AbstractDB = require('../../common/db');

var DB = function (provider, dbName, adapter) {
  this._provider = provider;
  this._dbName = dbName;
  this._idName = '$id'; // TODO: should every idName be moved to the DB layer?
  this._db = this; // allow a wrapping DB to be pased down to the wrapping item
  this._adapter = adapter;
};

inherits(DB, AbstractDB);

DB.prototype.use = function (name) {
  return Promise.resolve(new this._provider.CollectionWrapper(
    new this._provider.Collection(this._provider, name, this._db)));
};

DB.prototype.close = function () {
  return Promise.resolve();
};

module.exports = DB;