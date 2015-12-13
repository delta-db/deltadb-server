'use strict';

/* global before, after */

var partDir = '../../../../../scripts/partitioner/sql',
  partUtils = require('../utils'),
  commonTestUtils = require('deltadb-common-utils/scripts/test-utils'),
  constants = require(partDir + '/constants'),
  ForbiddenError = require(partDir + '/forbidden-error'),
  Attr = require(partDir + '/attr/attr'),
  System = require('../../../../../scripts/system'),
  Promise = require('bluebird'),
  DBExistsError = require('deltadb-common-utils/scripts/errors/db-exists-error'),
  DBMissingError = require('deltadb-common-utils/scripts/errors/db-missing-error'),
  commonUtils = require('deltadb-common-utils');

describe('attr', function () {

  var args = partUtils.init(this, beforeEach, afterEach, false, before, after);

  var attrRecs = null;

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

  it('should catch errors when creating', function () {
    var attr = new Attr();
    attr._processCreateErr(new ForbiddenError());
    attr._processCreateErr(new DBExistsError());
    attr._processCreateErr(new DBMissingError());
  });

  it('should throw non-forbidden error when creating', function () {
    var attr = new Attr(),
      err = new Error();
    return commonTestUtils.shouldNonPromiseThrow(function () {
      attr._processCreateErr(err);
    }, err);
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

  it('should throw error when creating db', function () {
    var attr = new Attr(),
      err = new Error();

    attr._params = { // fake
      value: {
        name: 'mydb'
      }
    };

    attr._partitioner = { // fake
      createAnotherDatabase: commonUtils.promiseErrorFactory(err)
    };

    return commonTestUtils.shouldThrow(function () {
      return attr._createDB();
    }, err);
  });

  it('should catch errors when creating db', function () {
    var attr = new Attr(),
      err = new DBExistsError();

    attr._params = { // fake
      value: {
        name: 'mydb'
      }
    };

    attr._partitioner = { // fake
      createAnotherDatabase: commonUtils.promiseErrorFactory(err)
    };

    return attr._createDB();
  });

  it('should throw error when destroying db', function () {
    var attr = new Attr(),
      err = new Error();

    attr._params = { // fake
      value: {
        name: 'mydb'
      }
    };

    attr._partitioner = { // fake
      destroyAnotherDatabase: commonUtils.promiseErrorFactory(err)
    };

    return commonTestUtils.shouldThrow(function () {
      return attr._destroyDB();
    }, err);
  });

  it('should catch errors when destroying db', function () {
    var attr = new Attr(),
      err = new DBMissingError();

    attr._params = { // fake
      value: {
        name: 'mydb'
      }
    };

    attr._partitioner = { // fake
      destroyAnotherDatabase: commonUtils.promiseErrorFactory(err)
    };

    return attr._destroyDB();
  });

});
