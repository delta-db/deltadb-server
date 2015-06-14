'use strict';

var EventEmitter = require('events').EventEmitter,
  inherits = require('inherits');

var Adapter = function () {};

inherits(Adapter, EventEmitter);

// Adapter.prototype.connect = function ( /* opts */ ) {};

module.exports = Adapter;