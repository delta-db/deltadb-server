'use strict';

var inherits = require('inherits'),
  CommonAdapter = require('../../common/adapter'),
  DB = require('./db');
  // Properties = require('./properties'); // TODO: remove??

var Adapter = function () {
  this._dbs = {};
  // this._props = new Properties(this); // TODO: remove??
};

inherits(Adapter, CommonAdapter);

// TODO: remove?
// Adapter.prototype.load = function () {
//   var self = this;
//   this._props.dbs(function (db) {
//     console.log('dbName=', db);
//   });
// };

// TODO: remove?
// Adapter.prototype.all = function (callback) {
//   var self = this;
//   self._props.dbs(function (dbName) {
//     callback(self.db({ db: dbName }));
//   });
// };

// TODO: remove?
// Adapter.prototype.destroy = function () {
//   var promises = [];
//   self.all(function (db) {
//     promises.push(db.close().destroy());
//   });
//   return Promise.all(promises);
// };

// opts: db
Adapter.prototype.db = function (opts) {
  var name = opts.db;
  if (!this._dbs[name]) {
    this._dbs[name] = new DB(name, this);
  }
  return this._dbs[name];
};

module.exports = Adapter;