'use strict';

var Process = require('../../../scripts/server/process'),
  testUtils = require('../../utils'),
  commonUtils = require('../../common-utils'),
  SocketClosedError = require('../../../scripts/orm/sql/common/socket-closed-error');

describe('process', function () {

  var process = null;

  beforeEach(function () {
    process = new Process();
  });

  it('should throw error when processing and catching', function () {
    // Fake
    var err = new Error('an error');
    var partitioner = {
      process: testUtils.promiseErrorFactory(err)
    };

    return commonUtils.shouldThrow(function () {
      return process._processAndCatch(partitioner);
    }, err);
  });

  it('should throw error when processing', function () {
    // Fake
    var err = new Error('an error');
    process._partitioner = testUtils.promiseErrorFactory(err);

    return commonUtils.shouldThrow(function () {
      return process._processDB();
    }, err);
  });

  it('should ignore error when processing', function () {
    // Fake
    var err = new SocketClosedError('an error');
    process._partitioner = testUtils.promiseErrorFactory(err);

    // An SocketClosedErrors are not thrown as the DB may have just been destroyed
    return process._processDB();
  });

  it('should throw error when authenticating', function () {
    // Fake
    var err = new Error('an error');
    var partitioner = {
      _users: {
        authenticated: testUtils.promiseErrorFactory(err)
      }
    };
    process._partitioner = testUtils.promiseResolveFactory(partitioner);

    return commonUtils.shouldThrow(function () {
      return process.authenticated();
    }, err);
  });

});
