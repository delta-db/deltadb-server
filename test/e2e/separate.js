'use strict';

var Client = require('../../scripts/client/adapter'),
  DB = require('../../scripts/client/db'),
  Promise = require('bluebird'),
  utils = require('../utils');

describe('separate', function () {

  var
    clientA = null,
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
      db: 'mydb'
    });

    bTasks = b.col('tasks');
  };

  beforeEach(function () {
    createA();
    createB();
  });

  afterEach(function () {
    return a.destroy().then(function () {
      return b.destroy();
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
      utils.changesShouldEql([{
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
      utils.changesShouldEql([{
        name: 'thing',
        val: '"write"',
        col: 'tasks'
      }], aEmitChanges);
    };

    var bEmitChangesShouldEql = function () {
      utils.changesShouldEql([{
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
      }, utils.TIMEOUT - 2000); // utils.TIMEOUT - 1 sec is not enough time

    });

  });

});