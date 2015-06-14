'use strict';

var utils = require('../../../utils'),
  EventEmitter = require('events').EventEmitter,
  inherits = require('inherits');

var DB = function () {};

inherits(DB, EventEmitter);

// DB.prototype.use = function ( /* name */ ) {};

DB.prototype.close = utils.resolveFactory();

// DB.prototype.destroy = function () {};

module.exports = DB;