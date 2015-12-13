'use strict';

var Client = require('deltadb/scripts/adapter'),
  DB = require('deltadb/scripts/db'),
  Promise = require('bluebird'),
  browserTestUtils = require('../browser-utils'),
  MemAdapter = require('deltadb-orm-nosql/scripts/adapters/mem');

describe('separate', function () {

  var clientA = null,
    a = null,
    aTasks = null,
    clientB = null,
    b = null,
    bTasks = null;

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

    bTasks = b.col('tasks');
  };

  beforeEach(function () {
    createA();
    createB();
  });

  afterEach(function () {
    // IndexedDB doesn't allow us to destroy a DB that is in use. Therefore, we use keepLocal=true
    // so that we can close connection b first.
    return b.destroy(false, true).then(function () {
      return a.destroy();
    });
  });

  it('should send and receive partial changes', function () {

    var aEmitChanges = [],
      bEmitChanges = [],
      aSetChanges = [],
      bSetChanges = [],
      docUUID = clientA.uuid();

    var task1 = aTasks.doc({
      $id: docUUID,
      thing: 'write'
    });

    var task2 = bTasks.doc({
      $id: docUUID,
      priority: 'high'
    });

    var setChangesShouldEql = function (changes) {
      browserTestUtils.changesShouldEql([{
        name: 'thing',
        val: '"write"',
        col: 'tasks'
      }, {
        name: 'priority',
        val: '"high"',
        col: 'tasks'
      }], changes);
    };

    var aEmitChangesShouldEql = function () {
      browserTestUtils.changesShouldEql([{
        name: 'thing',
        val: '"write"',
        col: 'tasks'
      }], aEmitChanges);
    };

    var bEmitChangesShouldEql = function () {
      browserTestUtils.changesShouldEql([{
        name: 'priority',
        val: '"high"',
        col: 'tasks'
      }], bEmitChanges);
    };

    // Create spy to verify that changes sent only once
    a._emitChanges = function (changes) {
      aEmitChanges = aEmitChanges.concat(changes);
      return DB.prototype._emitChanges.apply(this, arguments);
    };

    // Create spy to verify that changes received only once
    a._setChanges = function (changes) {
      aSetChanges = aSetChanges.concat(changes);
      return DB.prototype._setChanges.apply(this, arguments);
    };

    // Create spy to verify that changes sent only once
    b._emitChanges = function (changes) {
      bEmitChanges = bEmitChanges.concat(changes);
      return DB.prototype._emitChanges.apply(this, arguments);
    };

    // Create spy to verify that changes received only once
    b._setChanges = function (changes) {
      bSetChanges = bSetChanges.concat(changes);
      return DB.prototype._setChanges.apply(this, arguments);
    };

    var shouldResolve = function (resolve, reject) {

      try {
        aEmitChangesShouldEql(aEmitChanges);
        setChangesShouldEql(aSetChanges);
        bEmitChangesShouldEql(bEmitChanges);
        setChangesShouldEql(bSetChanges);
      } catch (err) {
        reject(err);
      }

      resolve();

    };

    task1.save();
    task2.save();

    return new Promise(function (resolve, reject) {
      // Wait just less than the max amount to see if extra changes were exchanged
      setTimeout(function () {
        shouldResolve(resolve, reject);
      }, browserTestUtils.TIMEOUT - 2000); // browserTestUtils.TIMEOUT - 1 sec is not enough time

    });

  });

});
