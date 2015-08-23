'use strict';

var inherits = require('inherits'),
  CommonAdapter = require('../../common/adapter'),
  DB = require('./db');

var Adapter = function () {};

inherits(Adapter, CommonAdapter);

// opts: db
Adapter.prototype.db = function (opts) {
  var db = new DB(opts.db, this);
  this.emit('db:create', db); // TODO: shouldn't this be moved to common?
  return db;
};

module.exports = Adapter;