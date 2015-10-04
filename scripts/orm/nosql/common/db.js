'use strict';

// TODO: create all() that returns iterator for all collections

var utils = require('../../../utils'),
  EventEmitter = require('events').EventEmitter,
  inherits = require('inherits');

var DB = function (name, adapter) {
  EventEmitter.apply(this, arguments); // apply parent constructor
  this._name = name;
  this._adapter = adapter;
  this._idName = '$id'; // TODO: should every idName be moved to the DB layer?
};

inherits(DB, EventEmitter);

// DB.prototype.col = function ( /* name */ ) {};

DB.prototype.close = utils.resolveFactory();

// DB.prototype.destroy = function () {};

module.exports = DB;