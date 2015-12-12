'use strict';

// TODO: is this the best dir for this file?

var commonTestUtils = require('../common-utils'),
  oldUtils = require('deltadb-common-utils'),
  Promise = require('bluebird'),
  IDB = require('../../scripts/orm/nosql/adapters/indexeddb'),
  newUtils = require('../new-utils'),
  utils = require('deltadb-common-utils');

var Adapter = function (AdapterClass) {
  this._Adapter = AdapterClass;
  this._adapter = new AdapterClass();
};

Adapter.prototype.test = function () {

  var adapter = this._adapter; // for convenience

  describe('idb', function () {

    var db = null,
      idb = null;

    beforeEach(function () {
      db = adapter.db({
        db: 'mydb'
      });
    });

    afterEach(function () {
      return db.destroy();
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
        newUtils.eql(expCols, cols);
      };

      db._destroy = utils.resolveFactory(); // fake as we want to preserve for reload

      var restore = function () {
        return db.destroy().then(function () {
          idb = new IDB(); // Simulate a fresh instance during an initial load
          db = idb.db({
            db: 'mydb'
          });
          return oldUtils.once(db, 'load'); // wait for data to load
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

      return commonTestUtils.shouldThrow(function () {
        return users.find({
          offset: 0
        }, function () {});
      }, new Error());
    });

    // TODO: remove after add limit functionality to IDB
    it('should throw error when finding with limit', function () {
      var users = db.col('users');

      return commonTestUtils.shouldThrow(function () {
        return users.find({
          limit: 1
        }, function () {});
      }, new Error());
    });

    it('should close when not yet opened', function () {
      return db.close().then(function () {
        // We need to reopen the DB so that it can be destroyed. TODO: Is there a cleaner way?
        return db._reopen();
      });
    });

    it('should throw error when opening or closing', function () {
      var err = new Error('my err');
      return commonTestUtils.shouldThrow(function () {
        return db._openClose(utils.promiseErrorFactory(err));
      }, err);
    });

  });

};

module.exports = Adapter;
