'use strict';

var adapters = require('../../../../scripts/orm/sql/adapters'),
  testORM = require('./test-orm'),
  testMultipleORM = require('./test-multiple-orm'),
  utils = require('../../../../scripts/utils');

describe('sql', function () {
  utils.each(adapters, function (adapter, name) {
    testORM(name, adapter);
    testMultipleORM(name, adapter);
  });
});