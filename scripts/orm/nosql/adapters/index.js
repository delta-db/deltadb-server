'use strict';

// Note: browserify cannot require modules dynamically so we have to manually require all the
// adapters here

var Adapters = {};

Adapters['indexeddb'] = require('./indexeddb');
Adapters['mem'] = require('./mem');

// TODO: update mongo adapter--this adapter is experimental and probably outdated
// Adapters['mongo'] = require('./mongo');

module.exports = Adapters;