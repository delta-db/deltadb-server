'use strict';

/* global after */

var Client = require('deltadb/scripts/adapter'),
  Promise = require('bluebird'),
  testUtils = require('../utils'),
  commonUtils = require('deltadb-common-utils');

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
      db: 'mydb'
    });

    bTasks = b.col('tasks');
  };

  var createBoth = function () {
    createA();
    createB();
  };

  var destroyBoth = function () {
    // IndexedDB doesn't allow us to destroy a DB that is in use. Therefore, we use keepLocal=true
    // so that we can close connection b first.
    return b.destroy(false, true).then(function () {
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
    self.timeout(testUtils.TIMEOUT);
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
