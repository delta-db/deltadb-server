'use strict';

/* global after */

var Client = require('deltadb/scripts/adapter'),
  Promise = require('bluebird'),
  browserTestUtils = require('../browser-utils'),
  commonUtils = require('deltadb-common-utils'),
  MemAdapter = require('deltadb-orm-nosql/scripts/adapters/mem'),
  clientUtils = require('deltadb/scripts/utils'),
  config = require('deltadb/scripts/config');

describe('race', function () {

  var self = this,
    clientA = null,
    a = null,
    aTasks = null,
    clientB = null,
    b = null,
    bTasks = null;

  // A lot of time is needed as we destroy and create the dbs several times. Unfortunately, it
  // appears that mocha doesn't support embedding this in a before() or beforeEach().
  this.timeout(40000);

  // Use Client instead of DeltaDB so that we can simulate separate clients
  var createA = function () {
    clientA = new Client();

    a = clientA.db({
      db: 'mydb'
    });

    aTasks = a.col('tasks');
  };

  // Use Client instead of DeltaDB so that we can simulate separate clients
  var createB = function () {
    clientB = new Client();

    b = clientB.db({
      db: 'mydb',

      // TODO: remove once we support multiple clients per IndexedDB
      // Use a MemAdapter here as we don't currently support two different clients in the same app
      // sharing the same IndexedDB.
      store: new MemAdapter().db('mydb')
    });

    // TODO: remove once we support multiple clients per IndexedDB
    // Use a MemAdapter here as we don't currently support two different clients in the same app
    // sharing the same IndexedDB.
    b._sysDB = b._adapter.db({
      db: clientUtils.SYSTEM_DB_NAME,
      alias: config.SYSTEM_DB_NAME_PREFIX + b._name,
      url: b._url,
      local: b._localOnly,
      store: new MemAdapter().db('system')
    });

    bTasks = b.col('tasks');
  };

  var createBoth = function () {
    createA();
    createB();
  };

  var destroyBoth = function () {
    return b.destroy().then(function () {
      return a.destroy();
    });
  };

  beforeEach(function () {
    return createBoth();
  });

  afterEach(function () {
    return destroyBoth();
  });

  after(function () {
    self.timeout(browserTestUtils.TIMEOUT);
  });

  var sendAndReceivePartialChanges = function () {

    var docUUID = clientA.uuid();

    var task1 = aTasks.doc({
      $id: docUUID,
      thing: 'write'
    });

    var task2 = bTasks.doc({
      $id: docUUID,
      priority: 'high'
    });

    return Promise.all([
      commonUtils.once(aTasks, 'attr:record'),
      commonUtils.once(bTasks, 'attr:record'),
      task1.save(),
      task2.save()
    ]);

  };

  var createSendReceiveDestroy = function (i) {
    var promise = Promise.resolve();
    if (i > 0) {
      promise = destroyBoth().then(function () {
        createBoth();
        return null; // prevent runaway promise warning
      });
    }
    return promise.then(function () {
      return sendAndReceivePartialChanges();
    });
  };

  var createSendReceiveDestroyFactory = function (i) {
    return function () {
      return createSendReceiveDestroy(i);
    };
  };

  it('should send and receive partial changes multiple times', function () {

    // This test has allowed us to detect a number of race conditions that could otherwise go
    // undetected

    var chain = Promise.resolve();

    for (var i = 0; i < 5; i++) {
      chain = chain.then(createSendReceiveDestroyFactory(i));
    }

    return chain;
  });

});
