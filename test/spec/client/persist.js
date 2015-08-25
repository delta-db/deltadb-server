'use strict';

var utils = require('../../../scripts/utils'),
  testUtils = require('../../utils'),
  MemAdapter = require('../../../scripts/orm/nosql/adapters/mem'),
  Client = require('../../../scripts/client/adapter'),
  Doc = require('../../../scripts/client/doc'),
  clientUtils = require('../../../scripts/client/utils');

describe('client', function () {

  var store = new MemAdapter();
  var client = new Client(store);
  var db = null,
    tasks = null;

  beforeEach(function () {
    db = client.db({
      db: 'mydb'
    });
    return db.col('tasks').then(function (collection) {
      tasks = collection;
    });
  });

  it('it should restore from store', function () {
    var client2 = null, db2 = null, tasks2 = null, task2 = null;

    var task = tasks.doc();

    var nowStr = (new Date()).getTime();

    // Fake dat to ensure that states are reloaded. The data is dummy data and is not logically
    // sound.
    var dat = {
      data: { $id: '1', thing: 'sing', priority: 'high' },
      changes: [
        {
          id: '1',
          col: 'tasks',
          name: 'thing',
          val: '"sing"',
          up: nowStr,
          re: nowStr
        }, {
          id: '2',
          col: 'tasks',
          name: 'priority',
          val: '"high"',
          up: nowStr,
          re: nowStr
        }
      ],
      latest: {
        thing: {
          val: 'sing',
          up: nowStr,
          seq: 2,
          re: nowStr
        }
      },
      destroyedAt: nowStr,
      updatedAt: nowStr,
      recordedAt: nowStr
    };

    task._dat = utils.clone(dat);
    task.id(task._dat.data.$id);

// TODO: don't forget to test db.props.since

// TODO: instead, need a function that loads from store and creates dbs, collections, docs on demand

    return task.save().then(function () {
      // Simulate a reload from store, e.g. when an app restarts
      client2 = new Client(store);
      db2 = client2.db({
        db: 'mydb2'
      });
      return db2.col('tasks');
    }).then(function (collection) {
console.log(collection);
      tasks2 = collection;
    }).then(function () {
      tasks2.get('1');
    }).then(function (task2) {
console.log(task2);
    });
  });

});