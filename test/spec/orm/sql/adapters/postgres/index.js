'use strict';

var SQL = require('../../../../../../scripts/orm/sql/adapters/postgres'),
  commonUtils = require('../../../../../common-utils'),
  connections = require('../../../../../../scripts/orm/sql/adapters/postgres/connections'),
  SocketClosedError = require('../../../../../../scripts/orm/sql/common/socket-closed-error');

describe('postgres', function () {
  var sql = null;

  beforeEach(function () {
    sql = new SQL();
  });

  it('should throw errors when connecting', function () {
    var err = new Error();
    return commonUtils.shouldNonPromiseThrow(function () {
      sql._processConnectError(err);
    }, err);
  });

  it('should prevent race conditions when unregistering', function () {
    // This fn would throw an error if it was unable to handle the race conditions
    return connections._unregister(1, 'db', 'host', 'username', 'password', 8080);
  });

  it('should handle race conditions when querying', function () {
    // Fake
    sql._connection = null;

    return commonUtils.shouldThrow(function () {
      return sql._query();
    }, new SocketClosedError());
  });
});
