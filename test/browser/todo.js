'use strict';

var IDB = require('../../scripts/orm/nosql/adapters/indexeddb'),
  Promise = require('bluebird'),
  utils = require('../new-utils');

describe('todo', function () {

  var idb = null,
    db = null;

  beforeEach(function () {
    idb = new IDB();
    db = idb.db({
      db: 'mydb'
    });
  });

  afterEach(function () {
    return db.close().then(function () {
      return db.destroy();
    });
  });

  it('should create doc', function () {
    return db.col('tasks').then(function (tasks) {
      var task = tasks.doc({
        thing: 'sing'
      });
      return task.set({
        priority: 'high'
      });
    });
  });

  it('should reload', function () {

    var createTasks = function () {
      var tasks = null;
      return db.col('tasks').then(function (_tasks) {
        tasks = _tasks;
        return tasks.doc({
          $id: '1',
          thing: 'write'
        }).save();
      }).then(function () {
        return tasks.doc({
          $id: '2',
          thing: 'sing'
        }).save();
      });
    };

    var createColors = function () {
      var colors = null;
      return db.col('colors').then(function (_colors) {
        colors = _colors;
        return colors.doc({
          $id: '3',
          name: 'red'
        }).save();
      }).then(function () {
        return colors.doc({
          $id: '4',
          name: 'green'
        }).save();
      });
    };

    var cols = {};

    var all = function () {
      var promises = [];
      db.all(function (col) {
        var docs = {};
        cols[col._name] = docs;
        var promise = col.all(function (doc) {
          docs[doc.id()] = doc.get();
        });
        promises.push(promise);
      });
      return Promise.all(promises);
    };

    var assert = function () {
      var expCols = {
        tasks: {
          '1': {
            $id: '1',
            thing: 'write'
          },
          '2': {
            $id: '2',
            thing: 'sing'
          }
        },
        colors: {
          '3': {
            $id: '3',
            name: 'red'
          },
          '4': {
            $id: '4',
            name: 'green'
          }
        }
      };
      utils.eql(expCols, cols);
    };

    var restore = function () {
      return db.close().then(function () {
        idb = new IDB(); // Simulate a fresh instance during an initial load
        db = idb.db({
          db: 'mydb'
        });
        return db._load();
      }).then(function () {
        return all();
      }).then(function () {
        assert();
      });
    };

    return createTasks().then(function () {
      return createColors();
    }).then(function () {
      return restore();
    });

  });

});