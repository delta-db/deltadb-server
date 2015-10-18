'use strict';

var SQL = require('../../../../../../scripts/orm/sql/adapters/postgres'),
  commonUtils = require('../../../../../common-utils');

describe('postgres', function () {
  var sql = new SQL();

  it('should throw errors when connecting', function () {
    var err = new Error();
    return commonUtils.shouldNonPromiseThrow(function () {
      sql._processConnectError(err);
    }, err);
  });
});