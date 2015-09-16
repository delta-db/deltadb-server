'use strict';

// TODO: is this the best dir for this file?

var commonUtils = require('../common-utils'),
  oldUtils = require('../../scripts/utils'),
  Promise = require('bluebird');

var Adapter = function (adapter) {
  this._adapter = adapter;
};

Adapter.prototype.test = function () {

  var adapter = this._adapter; // for convenience

  describe('adapter', function () { // TODO: output name

    var db = null,
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

    // TODO: remove after add offset functionality to IDB
    it('should throw error when finding with offset', function () {
      return db.col('users').then(function (users) {
        commonUtils.shouldThrow(function () {
          return users.find({
            offset: 0
          }, function () {});
        }, new Error());
      });
    });

    // TODO: remove after add limit functionality to IDB
    it('should throw error when finding with limit', function () {
      return db.col('users').then(function (users) {
        commonUtils.shouldThrow(function () {
          return users.find({
            limit: 1
          }, function () {});
        }, new Error());
      });
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