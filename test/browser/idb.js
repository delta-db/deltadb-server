'use strict';

// TODO: is this the best dir for this file?

var commonUtils = require('../common-utils'),
  oldUtils = require('../../scripts/utils'),
  Promise = require('bluebird'),
  IDB = require('../../scripts/orm/nosql/adapters/indexeddb'),
  utils = require('../new-utils');

var Adapter = function (adapter) {
  this._adapter = adapter;
};

Adapter.prototype.test = function () {

  var adapter = this._adapter; // for convenience

  describe('idb', function () {

    var db = null,
      idb = null,
      n = 1;

    beforeEach(function () {
      // For some unknown reason, it appears that the Chrome and Firefox will return an error if we
      // try to open a new DB with the same name as a DB that was just closed. Even if we wait for
      // the onsuccess callback after executing indexedDB.deleteDatabase(). Therefore, we will make
      // sure that DB name is unique per test.
      db = adapter.db({
        db: 'mydb' + (n++)
      });
    });

    afterEach(function () {
      return db.close().then(function () {
        return db.destroy();
      });
    });

    it('should create doc', function () {
      var tasks = db.col('tasks');

      var task = tasks.doc({
        thing: 'sing'
      });

      return task.set({
        priority: 'high'
      });
    });

    it('should reload', function () {

      var createTasks = function () {
        var tasks = db.col('tasks');

        return tasks.doc({
          $id: '1',
          thing: 'write'
        }).save().then(function () {
          return tasks.doc({
            $id: '2',
            thing: 'sing'
          }).save();
        });
      };

      var createColors = function () {
        var colors = db.col('colors');

        return colors.doc({
          $id: '3',
          name: 'red'
        }).save().then(function () {
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
            db: 'mydb' + (n - 1) // n - 1 for previous db name
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

    // TODO: remove after add offset functionality to IDB
    it('should throw error when finding with offset', function () {
      var users = db.col('users');

      commonUtils.shouldThrow(function () {
        return users.find({
          offset: 0
        }, function () {});
      }, new Error());
    });

    // TODO: remove after add limit functionality to IDB
    it('should throw error when finding with limit', function () {
      var users = db.col('users');

      commonUtils.shouldThrow(function () {
        return users.find({
          limit: 1
        }, function () {});
      }, new Error());
    });

    it('should catch error when creating object store', function () {
      return new Promise(function (resolve) {
        var err = new Error('err');
        db._createObjectStoreIfMissing = oldUtils.promiseErrorFactory(err); // stub

        var os = {
          callback: function (_err) {
            _err.should.eql(err);
            resolve();
          }
        };

        db._openAndCreateObjectStoreFactory(os)();
      });
    });

  });

};

module.exports = Adapter;