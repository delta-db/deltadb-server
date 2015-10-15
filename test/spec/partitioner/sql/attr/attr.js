'use strict';

/* global before, after */

var partDir = '../../../../../scripts/partitioner/sql',
  partUtils = require('../utils'),
  constants = require(partDir + '/constants'),
  ForbiddenError = require(partDir + '/forbidden-error'),
  Attr = require(partDir + '/attr/attr'),
  System = require('../../../../../scripts/system'),
  Promise = require('bluebird');

describe('attr', function () {

  var args = partUtils.init(this, beforeEach, afterEach, false, before, after);

  var testUtils = args.utils,
    attrRecs = null;

  beforeEach(function () {
    attrRecs = args.db._partitions[constants.LATEST]._attrRecs;
    return args.db._sql.truncateTable(attrRecs._name);
  });

  it('should construct without params', function () {
    new Attr();
  });

  it('should set destroyed or update doc', function () {
    var attr = new Attr();
    attr.destroyingDoc = function () {
      return false;
    };
    attr._partitionName = constants.ALL;
    attr._partitions = {};
    attr._partitions[constants.ALL] = {
      _docs: {
        update: function () {
          return Promise.resolve();
        }
      }
    };
    attr.setDestroyedOrUpdateDoc();
  });

  it('should throw non-forbidden error when creating', function () {
    var attr = new Attr();
    attr.create = function () {
      return new Promise(function () {
        throw new Error('err');
      });
    };
    return testUtils.shouldThrow(function () {
      return attr.createLatestAndAllAndRecentAndRecentAttr();
    }, new Error('err'));
  });

  it('should handle forbidden error when creating', function () {
    var attr = new Attr();
    attr.create = function () {
      return new Promise(function () {
        throw new ForbiddenError('err');
      });
    };
    return attr.createLatestAndAllAndRecentAndRecentAttr();
  });

  it('should create database', function () {
    var dbCreated = null,
      attr = new Attr();

    attr._partitioner = { // fake
      _dbName: System.DB_NAME,
      createAnotherDatabase: function (dbName) { // mock creation
        dbCreated = dbName;
        return Promise.resolve();
      }
    };

    attr._params = { // fake
      name: System.DB_ATTR_NAME,
      value: {
        action: 'add',
        name: 'mydb'
      }
    };

    return attr.setOptions().then(function () {
      dbCreated.should.eql('mydb');
    });
  });

  it('should destroy database', function () {
    var dbDestroyed = null,
      attr = new Attr();

    attr._partitioner = { // fake
      _dbName: System.DB_NAME,
      destroyAnotherDatabase: function (dbName) { // mock creation
        dbDestroyed = dbName;
        return Promise.resolve();
      }
    };

    attr._params = { // fake
      name: System.DB_ATTR_NAME,
      value: {
        action: 'remove',
        name: 'mydb'
      }
    };

    return attr.setOptions().then(function () {
      dbDestroyed.should.eql('mydb');
    });
  });

  it('should not create or destroy database', function () {
    var db = null,
      attr = new Attr();

    attr._partitioner = { // fake
      _dbName: 'not' + System.DB_NAME,
      createAnotherDatabase: function (dbName) { // mock creation
        db = dbName;
        return Promise.resolve();
      },
      destroyAnotherDatabase: function (dbName) { // mock creation
        db = dbName;
        return Promise.resolve();
      }
    };

    attr._params = { // fake
      name: System.DB_ATTR_NAME,
      value: {
        action: 'add',
        name: 'mydb'
      }
    };

    return attr.setOptions().then(function () {
      (db === null).should.eql(true);
    });
  });

  // TODO: what if remote server receives a destroy DB before a create DB, will we keep trying to
  // destroy the DB or will this be ignored? This error should probably be ignored.

});