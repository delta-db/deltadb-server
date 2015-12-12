'use strict';

/* global before */

var log = require('deltadb/scripts/log'),
  IDBAdapter = require('../../scripts/orm/nosql/adapters/indexeddb/adapter'),
  adapterStore = require('deltadb/scripts/adapter-store');

// Use IndexedDB
adapterStore.newAdapter = function () {
  return new IDBAdapter();
};

describe('browser', function () {

  before(function () {
    // For debugging
    log.console(true);
  });

  require('./adapters');

  require('../spec/orm/nosql');

  require('../e2e/e2e');

});
