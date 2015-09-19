'use strict';

var inherits = require('inherits'),
  CommonAdapter = require('../../common/adapter'),
  DB = require('./db');
// Properties = require('./properties'); // TODO: remove??

var Adapter = function () {
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

module.exports = Adapter;