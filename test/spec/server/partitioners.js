'use strict';

var Partitioners = require('../../../scripts/server/partitioners'),
  commonTestUtils = require('deltadb-common-utils/scripts/test-utils'),
  SocketClosedError = require('deltadb-orm-sql/scripts/common/socket-closed-error'),
  Changes = require('../../../scripts/partitioner/sql/changes'),
  Promise = require('bluebird'),
  commonUtils = require('deltadb-common-utils');

describe('partitioners', function () {

  var partitioners = null,
    defReconnectMS = Partitioners._RECONNECT_MS;

  beforeEach(function () {
    Partitioners._RECONNECT_MS = defReconnectMS;
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
    partitioners._hasChanges = commonUtils.promiseErrorFactory(new Error('an error'));

    // Should not throw an error
    partitioners._doPoll({
      _dbName: 'dbname'
    });
  });

  it('should throw error when there is a changes error', function () {
    // Fake
    var err = new Error('an error');
    var partitioner = {
      changes: commonUtils.promiseErrorFactory(err)
    };

    return commonTestUtils.shouldThrow(function () {
      return partitioners._hasChanges(partitioner);
    }, err);
  });

  it('should throw error when finding changes', function () {
    // Fake
    var err = new Error('an error');
    var partitioner = {
      changes: commonUtils.promiseErrorFactory(err)
    };

    return commonTestUtils.shouldThrow(function () {
      return partitioners._changes(partitioner);
    }, err);
  });

  it('should paginate', function () {
    var emitted = [];

    // Fake
    var changes1 = [{
        name: 'thing',
        val: 'write'
      }],
      changes2 = [{
        name: 'thing',
        val: 'play'
      }],
      limit = 1,
      since = new Date('2014-01-01T10:00:00.000Z'),
      newSince = new Date('2014-01-01T11:00:00.000Z'),
      dbName = null,
      socket = null,
      partitioner = null,
      offset = 0, // start at beginning
      userId = null;

    // Mock
    partitioners._filteredChanges = function (dbName, socket, partitioner, since, limit,
      offset) {
      var changes = null;
      if (offset === 0) {
        changes = changes1.concat(Changes._HAS_MORE);
      } else {
        changes = changes2;
      }
      return Promise.resolve(changes);
    };

    // Spy
    partitioners._emitChanges = function (socket, changes, since) {
      emitted.push({
        changes: changes,
        since: since
      });
    };

    // Fake emitting of changes
    return partitioners._findAndEmitChangesByPage(dbName, socket, partitioner, since, limit,
      offset, userId, newSince).then(function () {
      emitted.should.eql([{
        changes: changes1,
        since: since
      }, {
        changes: changes2,
        since: newSince
      }]);
    });
  });

  it('should handle race condition when unregistering', function () {
    // Fake partitioner missing for db-name
    return partitioners.unregister('db-name');
  });

  it('should reconnect when receive socket closed error', function () {
    Partitioners._RECONNECT_MS = 1; // reduce sleep for testing

    var retry = 0;

    var partitioner = { // fake
      connect: function () {
        return new Promise(function (resolve, reject) {
          if (++retry === 2) {
            resolve();
          } else {
            reject(new SocketClosedError('my error'));
          }
        });
      }
    };

    // This will timeout if something goes wrong
    return partitioners._reconnect(partitioner);
  });

  it('should handle race conditions when queueing changes', function () {
    var socket = { // fake
      conn: {
        id: 'someid'
      }
    };

    // Fake partitioner missing for db-name
    return partitioners._queueChanges('db-name', socket);
  });

  it('should reconnect if socket closed when queueing', function () {
    partitioners._reconnectOrThrow = commonUtils.resolveFactory(); // fake

    var partitioner = { // fake
      queue: commonUtils.promiseErrorFactory(new SocketClosedError('my error'))
    };

    var msg = { // fake
      changes: null
    };

    return partitioners._queueAndReconnectOrThrowIfError(partitioner, msg);
  });

});
