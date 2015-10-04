'use strict';

// TODO: when get destroyDatabase working with client db then use it with afterEach to destroy the
// database

/* global before, after */

var MemAdapter = require('../../scripts/orm/nosql/adapters/mem'),
  Client = require('../../scripts/client/adapter'),
  partUtils = require('../spec/partitioner/sql/utils'),
  DB = require('../../scripts/client/db'),
  Promise = require('bluebird');

// TMP - BEGIN
var log = require('../../scripts/utils/log');
log.setSilent(false);
// TMP - END

describe('e2e', function () {

  var storeA = null,
    clientA = null,
    a = null,
    aTasks = null,
    storeB = null,
    clientB = null,
    b = null,
    bTasks = null;

  // TODO: remove the following line? May need to at least set the timeOut
  partUtils.init(this, beforeEach, afterEach, false, before, after);
this.timeout(10000); // TODO: remove!

  var createB = function () {
    storeB = new MemAdapter(); // TODO: also test with IndexedDB in browser
    clientB = new Client(storeB);

    b = clientB.db({
      db: 'mydb'
    });

    bTasks = b.col('tasks');
  };

  beforeEach(function () {
    storeA = new MemAdapter(); // TODO: also test with IndexedDB in browser
    clientA = new Client(storeA);

    a = clientA.db({
      db: 'mydb'
    });

    aTasks = a.col('tasks');

    // TODO: need to make client create DB with $system
  });

  afterEach(function () {
    return a.destroy().then(function () {
      if (b) {
        return b.destroy();
      }
    });
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

      setTimeout(function () {
        if (err) {
          throw new Error('did not receive change');
        }
      }, 3000);
    });

  });

  it('should send and receive partial changes', function () {
    createB();

    // TODO: make sure no duplicate data sent/received - uncomment code below once the DB is being
    // destroyed in afterEach. Currently, the commented code below only works when the DB is fresh

    var err1 = true,
      err2 = true,
      aNumSends = 0,
      aNumReceives = 0,
      bNumSends = 0,
      bNumReceives = 0;

    var task1 = aTasks.doc({
      $id: '1',
      thing: 'write'
    });

    var task2 = bTasks.doc({
      $id: '1',
      priority: 'high'
    });

    // Create spy to verify that changes sent only once
    a._emitChanges = function ( /* changes */ ) {
      aNumSends++;
      // utils.changesShouldEql([
      //   { name: '$id', val: '"1"',
      //     col: 'tasks' },
      //   { name: 'thing', val: '"write"',
      //     col: 'tasks' }], changes);
      return DB.prototype._emitChanges.apply(this, arguments);
    };

    var setChangesShouldEql = function ( /* changes */ ) {
      // utils.changesShouldEql([
      //   { name: 'thing', val: '"write"',
      //     col: 'tasks' },
      //   { name: 'priority', val: '"high"',
      //     col: 'tasks' }], changes);
    };

    // Create spy to verify that changes received only once
    a._setChanges = function (changes) {
      aNumReceives++;
      setChangesShouldEql(changes);
      return DB.prototype._setChanges.apply(this, arguments);
    };

    // Create spy to verify that changes sent only once
    b._emitChanges = function ( /* changes */ ) {
      bNumSends++;
      // utils.changesShouldEql([
      //   { name: '$id', val: '"1"',
      //     col: 'tasks' },
      //   { name: 'priority', val: '"high"',
      //     col: 'tasks' }], changes);
      return DB.prototype._emitChanges.apply(this, arguments);
    };

    // Create spy to verify that changes received only once
    b._setChanges = function (changes) {
      bNumReceives++;
      setChangesShouldEql(changes);
      return DB.prototype._setChanges.apply(this, arguments);
    };

    var shouldResolve = function (resolve) {
      if (!err1 && !err2) {
        // if (aNumSends !== 1) {
        //   throw new Error('a sent more than once');
        // }

        // if (aNumReceives !== 1) {
        //   throw new Error('a received more than once');
        // }

        // if (bNumSends !== 1) {
        //   throw new Error('b sent more than once');
        // }

        // if (bNumReceives !== 1) {
        //   throw new Error('b received more than once');
        // }

        resolve();
      }
    };

    return new Promise(function (resolve) {

      task1.on('attr:record', function (attr) {
        if (attr.name === 'priority') { // receiving priority from server?
          err1 = false;
          shouldResolve(resolve);
        }
      });

      task2.on('attr:record', function (attr) {
        if (attr.name === 'thing') { // receiving priority from server?
          err2 = false;
          shouldResolve(resolve);
        }
      });

      task1.save();
      task2.save();

      setTimeout(function () {
        if (err1 || err2) {
          throw new Error('did not receive change');
        }
      }, 3000);
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