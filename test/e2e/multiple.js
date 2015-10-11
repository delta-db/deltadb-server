'use strict';

/* global before, after */

var MemAdapter = require('../../scripts/orm/nosql/adapters/mem'),
  Client = require('../../scripts/client/adapter'),
  partUtils = require('../spec/partitioner/sql/utils'),
  DB = require('../../scripts/client/db'),
  Promise = require('bluebird'),
  clientUtils = require('../../scripts/client/utils'),
  utils = require('../utils');

describe('multiple', function () {

  var self = this,
    storeA = null,
    clientA = null,
    a = null,
    aTasks = null,
    storeB = null,
    clientB = null,
    b = null,
    bTasks = null;

// TODO: restore
this.timeout(20000);
// this.timeout(utils.TIMEOUT);

  var createA = function () {
    storeA = new MemAdapter(); // TODO: also test with IndexedDB in browser
    clientA = new Client(storeA);

    a = clientA.db({
      db: 'mydb'
    });

    aTasks = a.col('tasks');
  };

  var createB = function () {
    storeB = new MemAdapter(); // TODO: also test with IndexedDB in browser
    clientB = new Client(storeB);

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
    // TODO: make destroy disconnect so there aren't any more data exchanges?
    return b.destroy().then(function () {
      return a.destroy();
    });
  };

  beforeEach(function () {
    createBoth();
  });

  afterEach(function () {
    return destroyBoth();
  });

  after(function () {
    self.timeout(utils.TIMEOUT);
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
      clientUtils.once(aTasks, 'attr:record'),
      clientUtils.once(bTasks, 'attr:record'),
      task1.save(),
      task2.save()]);

  };

  var createSendReceiveDestroy = function (i) {
console.log('createSendReceiveDestroy, i=', i);
    var promise = Promise.resolve();
    if( i > 0) {
      promise = destroyBoth().then(function () {
        createBoth();
      });
    }
    return promise.then(function () {
      return sendAndReceivePartialChanges();
    });
  };

  var createSendReceiveDestroyFactory = function (i) {
console.log('%%%%%createSendReceiveDestroyFactory, i=', i);
    return function () {
      return createSendReceiveDestroy(i);
    }
  };

  it('should send and receive partial changes multiple times', function () {

    // This test has allowed us to detect a number of race conditions that could otherwise go
    // undetected

    var chain = Promise.resolve();

    for (var i = 0; i < 1; i++) {
        chain = chain.then(createSendReceiveDestroyFactory(i));
    }

    return chain;
  });

});