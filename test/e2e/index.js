'use strict';

/* global before, after */

var utils = require('../utils'),
  MemAdapter = require('../../scripts/orm/nosql/adapters/mem'),
  Client = require('../../scripts/client/adapter'),
  partUtils = require('../spec/partitioner/sql/utils'),
  DB = require('../../scripts/client/db');

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

  var args = partUtils.init(this, beforeEach, afterEach, false, before, after);

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

    // TODO: need to make client creates DB with $system
  });

  // TODO: when get destroyDatabase working with client db then use it with afterEach to destroy the
  // database

  it('should send changes', function () {

    var numSends = 0, numReceives = 0;

    var task1 = aTasks.doc({
      thing: 'write'
    });

    // Create spy to verify that changes sent only once
    a._emitChanges = function (changes) {
      numSends++;
      changes.should.eql([{ up: changes[0].up, id: changes[0].id, name: 'thing', val: '"write"',
        col: 'tasks' }]);
      return DB.prototype._emitChanges.apply(this, arguments);
    };

    // Create spy to verify that changes received only once
    a._setChanges = function (changes) {
      numReceives++;
      changes.should.eql([{ up: changes[0].up, id: changes[0].id, re: changes[0].re, name: 'thing',
        val: '"write"', col: 'tasks' }]);
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

  it('should send and receive changes', function () {
    createB();

// TODO: make sure no duplicate data sent/received

    var task1 = aTasks.doc({
      $id: '1',
      thing: 'write'
    });

    var task2 = bTasks.doc({
      $id: '1',
      priority: 'high'
    });

    return new Promise(function (resolve) {
      var err1 = true, err2 = true;
      
      task1.on('attr:record', function (attr) {
        if (attr.name === 'priority') { // receiving priority from server?
          err1 = false;
          if (!err2) { // both events received?
            resolve();
          }
        }
      });

      task2.on('attr:record', function (attr) {
        if (attr.name === 'thing') { // receiving priority from server?
          err2 = false;
          if (!err1) { // both events received?
            resolve();
          }
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
  // to trigger sync

  // TODO: test changes made to server after it has already done the initial sync, i.e. server needs
  // to trigger sync

  // TODO: test connect/disconnect and making changes when disconnected

});