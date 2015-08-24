'use strict';

var inherits = require('inherits'),
  CommonAdapter = require('../../common/adapter'),
  DB = require('./db');

var Adapter = function () {};

inherits(Adapter, CommonAdapter);

// opts: db
Adapter.prototype.db = function (opts) {
  var db = new DB(opts.db, this);
  return db;
};

module.exports = Adapter;