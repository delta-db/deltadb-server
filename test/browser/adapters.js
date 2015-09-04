'use strict';

var Adapter = require('../spec/orm/nosql/adapter');

describe('adapters', function () {

  // TODO: test all adapters with same code. May need to test indexeddb separately as can only be
  // tested in browser

  var ORM = require('../../scripts/orm/nosql/adapters/indexeddb');

  var adapter = new Adapter(new ORM());

  adapter.test();

});