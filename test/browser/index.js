'use strict';

var IDB = require('../../scripts/orm/nosql/adapters/indexeddb'),
  Promise = require('bluebird');

describe('browser-tmp', function () {

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

  // The order of the attributes appears to be an issue of concern in browsers so we cannot just
  // use .eql(). TODO: is there a better way, native to chai?
  var eql = function (exp, act) {
    var empty = true;
    var isString = typeof exp === 'string';
    if (!isString) {
      for (var i in exp) {
        if (exp.hasOwnProperty(i)) {
          empty = false;
          if (typeof act[i] === 'undefined') {
            act.should.eql(exp);
          } else {
            eql(exp[i], act[i]);
          }
        }
      }
    }
    if (isString || empty) {
      act.should.eql(exp);
    }
  };

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
        var promise = col.tmpFind(null, function (doc) {
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
      eql(expCols, cols);
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