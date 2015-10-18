'use strict';

var Adapters = {};

Adapters['postgres'] = require('./postgres');
// Adapters['mysql'] = require('./mysql'); // TODO

module.exports = Adapters;
