'use strict';

var Promise = require('bluebird'),
  inherits = require('inherits'),
  AbstractAdapter = require('../../adapter'),
  DB = require('./db');

var Adapter = function () {};

inherits(Adapter, AbstractAdapter);

// opts: db
Adapter.prototype.connect = function (opts) {
  return new Promise(function (resolve) {
    resolve(new DB(opts.db));
  });
};

module.exports = Adapter;