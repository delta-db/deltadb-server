'use strict';

var adapters = require('../../../../scripts/orm/sql/adapters'),
  testORM = require('./test-orm'),
  utils = require('../../../../scripts/utils');

describe('sql', function () {
  utils.each(adapters, function (adapter, name) {
    testORM(name, adapter);
  });
});