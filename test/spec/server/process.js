'use strict';

var Process = require('../../../scripts/server/process'),
  commonTestUtils = require('deltadb-common-utils/scripts/test-utils'),
  SocketClosedError = require('deltadb-orm-sql/scripts/common/socket-closed-error'),
  commonUtils = require('deltadb-common-utils');

describe('process', function () {

  var process = null;

  beforeEach(function () {
    process = new Process();
  });

  it('should throw error when processing and catching', function () {
    // Fake
    var err = new Error('an error');
    var partitioner = {
      process: commonUtils.promiseErrorFactory(err)
    };

    return commonTestUtils.shouldThrow(function () {
      return process._processAndCatch(partitioner);
    }, err);
  });

  it('should throw error when processing', function () {
    // Fake
    var err = new Error('an error');
    process._partitioner = commonUtils.promiseErrorFactory(err);

    return commonTestUtils.shouldThrow(function () {
      return process._processDB();
    }, err);
  });

  it('should ignore error when processing', function () {
    // Fake
    var err = new SocketClosedError('an error');
    process._partitioner = commonUtils.promiseErrorFactory(err);

    // An SocketClosedErrors are not thrown as the DB may have just been destroyed
    return process._processDB();
  });

  it('should throw error when authenticating', function () {
    // Fake
    var err = new Error('an error');
    var partitioner = {
      _users: {
        authenticated: commonUtils.promiseErrorFactory(err)
      }
    };
    process._partitioner = commonUtils.resolveFactory(partitioner);

    return commonTestUtils.shouldThrow(function () {
      return process.authenticated();
    }, err);
  });

});
