'use strict';

var Promise = require('bluebird'),
  inherits = require('inherits'),
  AbstractAdapter = require('../../adapter'),
  DB = require('./db');

var Adapter = function () {};

inherits(Adapter, AbstractAdapter);

// TODO: remove
// opts: db
Adapter.prototype.connect = function (opts) {
  var self = this;
  return new Promise(function (resolve) {
    resolve(new DB(opts.db, self));
  });
};

module.exports = Adapter;