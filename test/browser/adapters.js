'use strict';

var Adapter = require('../spec/orm/nosql/adapter');

describe('adapters', function () {

  var ORM = require('../../scripts/orm/nosql/adapters/indexeddb');

  var adapter = new Adapter(ORM);

  adapter.test();

  // TODO: want to test all applicable adapters in browser, but only execute certain tests for
  // certain browsers
  var IDBAdapter = require('./idb');
  var idbAdapter = new IDBAdapter(ORM);
  idbAdapter.test();

});