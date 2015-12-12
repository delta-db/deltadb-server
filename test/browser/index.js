'use strict';

/* global before */

var log = require('../../scripts/client/log'),
  IDBAdapter = require('../../scripts/orm/nosql/adapters/indexeddb/adapter'),
  adapterStore = require('../../scripts/client/adapter-store');

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

  require('../spec/utils/log');

  require('../spec/client');

  require('../e2e/e2e');

});
