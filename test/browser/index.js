'use strict';

var IDB = require('../../scripts/orm/nosql/adapters/indexeddb');

describe('browser-tmp', function () {

  var idb = null, db = null;

  beforeEach(function () {
    idb = new IDB();
    db = idb.db({ db: 'mydb' });
  });

  afterEach(function () {
//    return idb.destroy();
    
    // TODO: uncomment?
    // return db.close().then(function () {
    //  db.destroy();
    // });
  });

  it('should create doc', function () {
    return db.col('tasks').then(function (tasks) {
      var task = tasks.doc({ thing: 'sing' });
      return task.set({ priority: 'high' });
    });
  });

  it('should reload', function () {

    var createTasks = function () {
      var tasks = null;
      return db.col('tasks').then(function (_tasks) {
        tasks = _tasks;
        return tasks.doc({ thing: 'write' }).save();
      }).then(function () {
        return tasks.doc({ thing: 'sing' }).save();
      });      
    }

    var createColors = function () {
      var colors = null;
      return db.col('colors').then(function (_colors) {
        colors = _colors;
        return colors.doc({ name: 'red' }).save();
      }).then(function () {
        return colors.doc({ name: 'green' }).save();
      });  
    };

    var restore = function () {
      return db.close().then(function () {
        idb = new IDB(); // Simulate a fresh instance during an initial load
        return idb.load();
      }).then(function () {
// idb.all(function (_db) {
// console.log('_db._name=', _db._name)
// });
      });
    };

    return createTasks().then(function () {
      return createColors();
    }).then(function () {
      return restore();
    });

  });

});