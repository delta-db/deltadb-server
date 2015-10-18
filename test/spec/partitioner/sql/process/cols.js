'use strict';

/* global before, after */

var partDir = '../../../../../scripts/partitioner/sql',
  partUtils = require('../utils'),
  ForbiddenError = require(partDir + '/forbidden-error'),
  Promise = require('bluebird');

describe('cols', function () {

  var noAll = true; // disable all can CRUD policy as it interferes with our tests
  var args = partUtils.init(this, beforeEach, afterEach, noAll, before, after);
  var testUtils = args.utils;

  beforeEach(function () {
    return args.db._cols.truncateTable();
  });

  it('should take col inventory', function () {
    var up = new Date();
    var delta = {
      col_name: 'task',
      attr_name: 'priority',
      attr_val: '"high"',
      user_uuid: 'user-uuid',
      updated_at: up
    };
    args.db._process._takeColInventoryForAttr(delta);
    args.db._process._colIds.should.eql({
      'task': {
        userUUID: 'user-uuid',
        colName: 'task',
        updatedAt: up,
        recordedByUserId: null
      }
    });
  });

  it('should ignore cached cols when taking inventory', function () {
    var up = new Date();
    var delta = {
      col_name: 'task',
      attr_name: 'priority',
      attr_val: '"high"',
      user_uuid: 'user-uuid',
      updated_at: up
    };
    args.db._process._colIds['task'] = null; // mock previous lookup
    args.db._process._takeColInventoryForAttr(delta);
    args.db._process._colIds.should.eql({
      'task': null
    });
  });

  it('should create col', function () {
    args.db._process._userIds['user-uuid'] = 1; // mock creation of user
    args.db._process._colIds = {
      'task': {
        colName: 'task',
        userUUID: 'user-uuid',
        updatedAt: new Date()
      }
    };
    return args.db._process._lookupOrCreateCols().then(function () {
      return testUtils.findCols(args.db);
    }).then(function (results) {
      testUtils.contains([{
        name: '$ruuser-uuid'
      }, {
        name: 'task'
      }], results.rows);
    });
  });

  it('should throw error when cannot create col', function () {
    args.db._cols._canCreate = function (colName) { // mock
      // Don't fail for cleanup, e.g. $ru$super
      return Promise.resolve(colName !== 'col-name');
    };
    return testUtils.shouldThrow(function () {
      return args.db._process._canCreateCol('col-name');
    }, new ForbiddenError('cannot create col col-name'));
  });

  it('should look up or create user cols', function () {
    var userId = 1;
    return args.db._process._lookupOrCreateUserRoleColsIfPermitted('user-col-name',
      'role-col-name',
      userId, 'for-user-uuid', 'attr', userId);
  });

  it('should get or create col', function () {
    args.db._process._userIds = {
      'user-uuid': 1
    };
    return args.db._process._getOrCreateCol({
      userUUID: 'user-uuid2'
    });
  });

  it('should throw non-forbidden error', function () {
    args.db._process._cols.getColId = function () {
      return new Promise(function () {
        throw new Error('err');
      });
    };
    args.db._process._userIds = {
      'user-uuid': 1
    };
    return testUtils.shouldThrow(function () {
      return args.db._process._getOrCreateCol({
        userUUID: 'user-uuid'
      });
    }, new Error('err'));
  });

});
