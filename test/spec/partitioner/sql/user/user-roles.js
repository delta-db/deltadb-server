'use strict';

/* global before, after */

var partDir = '../../../../../scripts/partitioner/sql';

var partUtils = require('../utils'),
  UserRoles = require(partDir + '/user/user-roles'),
  Users = require(partDir + '/user/users'),
  Roles = require(partDir + '/roles'),
  SQLError = require('deltadb-orm-sql/scripts/common/sql-error');

describe('user-roles', function () {

  var args = partUtils.init(this, beforeEach, afterEach, false, before, after);
  var testUtils = args.utils;

  var userUtils = null;
  beforeEach(function () {
    userUtils = args.userUtils;
  });

  it('should create reserved user roles', function () {
    return args.db._sql.find(null, UserRoles.NAME, null, null, ['id', 'asc']).then(function (
      results) {
      testUtils.contains([{
        id: UserRoles.ID_SUPER,
        user_id: Users.ID_SUPER,
        role_id: Roles.ID_SUPER
      }], results.rows);
    });
  });

  it('should get doc id', function () {
    var userId = 1,
      roleId = 1,
      docId = 1;
    return args.db._sql.truncateTable(UserRoles.NAME).then(function () {
      return args.db._userRoles.create(userId, roleId, docId);
    }).then(function () {
      return args.db._userRoles.getDocId(userId, roleId);
    }).then(function (_docId) {
      _docId.should.eql(docId);
    });
  });

  it('should get or create when exists', function () {
    args.db._userRoles.getId = testUtils.promiseResolveFactory(1);
    return args.db._userRoles.getOrCreate().then(function (id) {
      id.should.eql(1);
    });
  });

  it('should throw non-sql error when getting or creating', function () {
    args.db._userRoles.getId = testUtils.promiseResolveFactory(null);
    args.db._userRoles.create = testUtils.promiseErrorFactory(new Error('err'));
    return testUtils.shouldThrow(function () {
      return args.db._userRoles.getOrCreate();
    }, new Error('err'));
  });

  it('should ignore sql error when getting or creating', function () {
    args.db._userRoles.getId = testUtils.promiseResolveFactory(null);
    args.db._userRoles.create = testUtils.promiseErrorFactory(new SQLError('err'));
    return args.db._userRoles.getOrCreate();
  });

});
