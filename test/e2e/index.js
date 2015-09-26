'use strict';

/* global before, after */

var utils = require('../utils'),
  MemAdapter = require('../../scripts/orm/nosql/adapters/mem'),
  Client = require('../../scripts/client/adapter'),
  partUtils = require('../spec/partitioner/sql/utils');

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

  beforeEach(function () {
    storeA = new MemAdapter(); // TODO: also test with IndexedDB in browser
    clientA = new Client(storeA);

    a = clientA.db({
      db: 'mydb'
    });

    aTasks = a.col('tasks');

    storeB = new MemAdapter(); // TODO: also test with IndexedDB in browser
    clientB = new Client(storeB);

    b = clientB.db({
      db: 'mydb'
    });

    bTasks = b.col('tasks');

    // TODO: need to make client create DB with $system
  });

  it('should send and receive changes', function () {
    var task1 = aTasks.doc({
      $id: '1',
      thing: 'write a song'
    });

    var task2 = bTasks.doc({
      $id: '1',
      priority: 'high'
    });

    var task1PriorityPromise = new Promise(function (resolve) {
      var err = true;
      
      task1.on('attr:record', function (attr) {
        if (attr.name === 'priority') { // receiving priority from server?
          err = false;
          resolve();
        }
      });

      task1.save();
      task2.save();

      setTimeout(function () {
        if (err) {
          throw new Error('did not receive priority');
        }
      }, 6000);
    });

    return task1PriorityPromise;

// TODO: do the same for task2Thing
  });

  // TODO: test changes made to client after it has already done the initial sync, i.e. client needs
  // to trigger sync

  // TODO: test changes made to server after it has already done the initial sync, i.e. server needs
  // to trigger sync

  // TODO: test connect/disconnect and making changes when disconnected

});