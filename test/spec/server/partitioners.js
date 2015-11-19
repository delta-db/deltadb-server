'use strict';

var Partitioners = require('../../../scripts/server/partitioners'),
  testUtils = require('../../utils'),
  commonUtils = require('../../common-utils'),
  SocketClosedError = require('../../../scripts/orm/sql/common/socket-closed-error');

describe('partitioners', function () {

  var partitioners = null;

  beforeEach(function () {
    partitioners = new Partitioners();
  });

  it('should replace uid', function () {
    // Fake
    partitioners._userUUID = function () {
      return 'user-uuid-2';
    };

    // Fake
    var changes = [{
      uid: 'user-uuid-1'
    }];

    partitioners._addUserUUID(null, null, changes);

    // Make sure uid gets replaced
    changes[0].uid.should.eql('user-uuid-2');
  });

  it('should set container when exists', function () {
    // This can occur when there is a race condition and can be hard to test w/o faking

    // Fake
    var socket = {
      conn: {
        id: 1
      }
    };

    // Fake
    var container = {
      conns: {
        1: {}
      }
    };

    // Fake
    partitioners._partitioners['dbname'] = {
      conns: {}
    };

    partitioners._setContainer('dbname', socket, container);

    partitioners._partitioners['dbname'].conns['1'].should.eql(container.conns['1']);
  });

  it('should handle errors when polling', function () {
    // Fake
    partitioners._partitioners['dbname'] = {
      since: new Date()
    };

    // Mock
    partitioners._hasChanges = testUtils.promiseErrorFactory(new Error('an error'));

    // Should not throw an error
    partitioners._doPoll({
      _dbName: 'dbname'
    });
  });

  it('should throw error when there is a changes error', function () {
    // Fake
    var err = new Error('an error');
    var partitioner = {
      changes: testUtils.promiseErrorFactory(err)
    };

    return commonUtils.shouldThrow(function () {
      return partitioners._hasChanges(partitioner);
    }, err);
  });

  it('should throw error when finding changes', function () {
    // Fake
    var err = new Error('an error');
    var partitioner = {
      changes: testUtils.promiseErrorFactory(err)
    };

    return commonUtils.shouldThrow(function () {
      return partitioners._changes(partitioner);
    }, err);
  });

  it('should ignore error when finding changes', function () {
    // Fake
    var err = new SocketClosedError('an error');
    var partitioner = {
      changes: testUtils.promiseErrorFactory(err)
    };

    // An SocketClosedErrors are not thrown as the DB may have just been destroyed
    return partitioners._changes(partitioner);
  });

});
