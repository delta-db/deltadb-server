'use strict';

var inherits = require('inherits'),
  CommonAdapter = require('../../common/adapter'),
  DB = require('./db'),
  utils = require('../../../../utils');

var Adapter = function () {
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

// TODO: should this return a promise like col.all()??
Adapter.prototype.all = function (callback) {
  utils.each(this._dbs, callback);
};

module.exports = Adapter;