'use strict';

var MemAdapter = require('../orm/nosql/adapters/mem/adapter');

/**
 * This class provides us with a global way of keeping the store selector abstracted so that we
 * don't have to include browser specific implementations, e.g. IndexedDB, in our node tests and
 * test coverage.
 */
var AdapterStore = function () {};

AdapterStore.prototype.newAdapter = function () {
  return new MemAdapter();
};

module.exports = new AdapterStore();
