'use strict';

var Promise = require('bluebird'),
  inherits = require('inherits'),
  CommonAdapter = require('../../common/adapter'),
  DB = require('./db'),
  Properties = require('./properties');

var Adapter = function () {
  this._dbs = {};
  this._props = new Properties(this);
};

inherits(Adapter, CommonAdapter);

Adapter.prototype.load = function () {
  var self = this;
  this._props.dbs(function (db) {
    console.log('dbName=', db);
  });
//  return this._props.load().then(function () {
// TODO: need to properly load down types
//    this.db({ db: dbName });
//  });
};

Adapter.prototype.all = function (callback) {
  var self = this;
  self._props.dbs(function (dbName) {
    callback(self.db({ db: dbName }));
  });
};

Adapter.prototype.destroy = function () {
  var promises = [];
  self.all(function (db) {
    promises.push(db.close().destroy());
  });
  return Promise.all(promises);
};

// opts: db
Adapter.prototype.db = function (opts) {
  var name = opts.db;
  if (!this._dbs[name]) {
    this._dbs[name] = new DB(name, this);
  }
  return this._dbs[name];
};

module.exports = Adapter;