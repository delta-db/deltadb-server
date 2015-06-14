'use strict';

/* global before, after */

var partDir = '../../../../scripts/partitioner/sql';

var partUtils = require('./utils'),
  Cols = require(partDir + '/col/cols'),
  Roles = require(partDir + '/roles'),
  Promise = require('bluebird'),
  SQLError = require('../../../../scripts/orm/sql/common/sql-error');

describe('roles', function () {

  var args = partUtils.init(this, beforeEach, afterEach, false, before, after);
  var testUtils = args.utils;

  var userUtils = null; // for convenience
  beforeEach(function () {
    userUtils = args.userUtils;
  });

  it('should create reserved roles', function () {
    return args.db._sql.find(null, 'roles', null, null, ['id', 'asc']).then(function (
      results) {
      testUtils.contains([{
        id: Roles.ID_SUPER,
        uuid: '$r$super'
      }, {
        id: Roles.ID_OWNER,
        uuid: '$r$owner'
      }, {
        id: Roles.ID_ALL,
        uuid: '$r$all'
      }], results.rows);
    });
  });

  it('should create a roleusers col', function () {
    return args.db._roles.create('role-uuid', 1, 'user-uuid', new Date()).then(function () {
      return args.db._sql.find(['name'], Cols.NAME, null, ['name', '=',
        '"$rurole-uuid"'
      ]);
    }).then(function (results) {
      results.rows.length.should.eql(1);
    });
  });

  it('should get or create role', function () {
    var changedByUserId = null,
      changedByUUID = null;
    return args.db._roles.getOrCreateRole('role-uuid', changedByUserId, changedByUUID, new Date())
      .then(function () {
        return userUtils.getRoleIds();
      }).then(function () {
        userUtils.roleIds['role-uuid'] = userUtils.roleId;
      });
  });

  it('should throw non-sql error', function () {
    args.db._roles.create = function () {
      throw new Error('err');
    };
    return testUtils.shouldThrow(function () {
      return args.db._roles.getOrCreateRole('role-uuid');
    }, new Error('err'));
  });

  it('should throw sql error', function () {
    args.db._roles.getRoleId = function () {
      return Promise.resolve(null);
    };

    args.db._roles.create = function () {
      return new Promise(function () {
        throw new SQLError('err');
      });
    };
    return args.db._roles.getOrCreateRole('role-uuid');
  });

});