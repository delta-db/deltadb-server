'use strict';

var MemAdapter = require('../../scripts/orm/nosql/adapters/mem'),
  Client = require('../../scripts/client/adapter'),
  DB = require('../../scripts/client/db'),
  Promise = require('bluebird'),
  utils = require('../utils');

describe('basic', function () {

  var storeA = null,
    clientA = null,
    a = null,
    aTasks = null,
    storeB = null,
    clientB = null,
    b = null,
    bTasks = null;

  this.timeout(utils.TIMEOUT);

  var createB = function () {
    storeB = new MemAdapter(); // TODO: also test with IndexedDB in browser
    clientB = new Client(storeB);

    b = clientB.db({
      db: 'mydb'
    });

    bTasks = b.col('tasks');
  };

  var createA = function () {
    storeA = new MemAdapter(); // TODO: also test with IndexedDB in browser
    clientA = new Client(storeA);

    a = clientA.db({
      db: 'mydb'
    });

    aTasks = a.col('tasks');
  };

  var destroyBoth = function () {
    var promise = b ? b.destroy() : Promise.resolve();
    return promise.then(function () {
      return a.destroy();
    });
  };

  beforeEach(function () {
    createA();
  });

  afterEach(function () {
    return destroyBoth();
  });

  it('should send and receive changes', function () {

    var numSends = 0,
      numReceives = 0;

    var task1 = aTasks.doc({
      thing: 'write'
    });

    // Create spy to verify that changes sent only once
    a._emitChanges = function (changes) {
      numSends++;
      changes.should.eql([{
        up: changes[0].up,
        id: changes[0].id,
        name: 'thing',
        val: '"write"',
        col: 'tasks'
      }]);
      return DB.prototype._emitChanges.apply(this, arguments);
    };

    // Create spy to verify that changes received only once
    a._setChanges = function (changes) {
      numReceives++;
      changes.should.eql([{
        up: changes[0].up,
        id: changes[0].id,
        re: changes[0].re,
        name: 'thing',
        val: '"write"',
        col: 'tasks'
      }]);
      return DB.prototype._setChanges.apply(this, arguments);
    };

    return new Promise(function (resolve) {
      var err = true;

      task1.on('attr:record', function (attr) {
        if (attr.name === 'thing') { // receiving priority from server?

          if (numSends !== 1) {
            throw new Error('sent more than once');
          }

          if (numReceives !== 1) {
            throw new Error('received more than once');
          }

          err = false;
          resolve();
        }
      });

      task1.save();
    });

  });

  it('should send and receive partial changes', function () {
    createB();

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
      utils.changesShouldEql([
        { name: 'thing', val: '"write"',
          col: 'tasks' },
        { name: 'priority', val: '"high"',
          col: 'tasks' }], changes);
    };

    var aEmitChangesShouldEql = function () {
      utils.changesShouldEql([
        { name: 'thing', val: '"write"',
          col: 'tasks' }], aEmitChanges);
    };

    var bEmitChangesShouldEql = function () {
      utils.changesShouldEql([
        { name: 'priority', val: '"high"',
          col: 'tasks' }], bEmitChanges);
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
      }, utils.TIMEOUT - 1000);

    });

  });

  // TODO: test changes made to client after it has already done the initial sync, i.e. client needs
  // to trigger sync. How to determine when initial sync done? Can do this with spy?

  // TODO: test changes made to server after it has already done the initial sync, i.e. server needs
  // to trigger sync. How to determine when initial sync done? Can do this with spy?

  // TODO: test connect/disconnect and making changes when disconnected

  // TODO: test send interval by making interval large and making a bunch of changes in a short
  // period of time and making sure sync only called twice

});
