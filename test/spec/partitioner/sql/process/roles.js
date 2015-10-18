'use strict';

/* global before, after */

var partDir = '../../../../../scripts/partitioner/sql',
  constants = require(partDir + '/constants'),
  partUtils = require('../utils'),
  UserRoles = require(partDir + '/user/user-roles'),
  Users = require(partDir + '/user/users'),
  utils = require(partDir + '/../../utils');

describe('roles', function () {

  var args = partUtils.init(this, beforeEach, afterEach, false, before, after);
  var testUtils = args.utils;

  var userUtils = null,
    userId = Users.ID_LAST_RESERVED + 1,
    implicitRole = null,
    policy = null;
  beforeEach(function () {
    userUtils = args.userUtils;
    implicitRole = userUtils.userUUID;
    policy = { // only implicitRole can access
      col: {
        create: implicitRole,
        read: implicitRole,
        update: implicitRole,
        destroy: implicitRole
      }
    };
  });

  var findUserRoles = function () {
    return args.db._sql.find(null, UserRoles.NAME, null, ['id', '>',
      '"' + UserRoles.ID_LAST_RESERVED + '"'
    ]);
  };

  it('should permit adding user role if have user & role access', function () {
    // We also verify that there are attrs as they control the permissions and track the history of
    // changes
    return userUtils.createUser(userUtils.userUUID, 'user', 'secret').then(function () {
      return userUtils.addUserRole(userUtils.userUUID, 'brole', userUtils.userUUID);
    }).then(function () {
      return userUtils.getRoleIds();
    }).then(function () {
      return findUserRoles();
    }).then(function (results) {
      testUtils.contains([{
        user_id: userId,
        role_id: userUtils.roleIds['user-uuid']
      }, {
        user_id: userId,
        role_id: userUtils.roleIds['brole']
      }], results.rows);
    }).then(function () {
      var attrs = [{
        name: '$role',
        value: JSON.stringify({
          action: 'add',
          userUUID: 'user-uuid',
          roleName: 'brole'
        })
      }, {
        name: '$ruser',
        value: JSON.stringify({
          action: 'add',
          userUUID: 'user-uuid',
          roleName: 'brole'
        })
      }];
      return testUtils.attrsShouldEql(args.db, constants.LATEST, attrs, true, [
        ['name', '=', '"$ruser"'], 'or', ['name', '=', '"$role"']
      ]);
    }).then(function () {
      return userUtils.removeUserRole(userUtils.userUUID, 'brole', userUtils.userUUID);
    }).then(function () {
      return findUserRoles();
    }).then(function (results) {
      testUtils.contains([{
        user_id: userId,
        role_id: userUtils.roleIds['user-uuid']
      }], results.rows);
    }).then(function () {
      var attrs = [{
        name: '$role',
        value: JSON.stringify({
          action: 'remove',
          userUUID: 'user-uuid',
          roleName: 'brole'
        })
      }, {
        name: '$ruser',
        value: JSON.stringify({
          action: 'remove',
          userUUID: 'user-uuid',
          roleName: 'brole'
        })
      }];
      return testUtils.attrsShouldEql(args.db, constants.LATEST, attrs, true, [
        ['name', '=', '"$ruser"'], 'or', ['name', '=', '"$role"']
      ]);
    });
  });

  it('should prohibit adding user role if no user access', function () {
    return userUtils.createUser(userUtils.userUUID, 'user', 'secret').then(function () {
      // Lockdown policy for user's roles
      return userUtils.setPolicy(policy, '$role' + userUtils.userUUID);
    }).then(function () {
      var changedByUUID = null;
      return userUtils.addUserRole(userUtils.userUUID, 'brole', changedByUUID);
    }).then(function () {
      return userUtils.getRoleIds();
    }).then(function () {
      utils.notDefined(userUtils.roleIds.brole).should.eql(true);
    }).then(function () {
      return findUserRoles();
    }).then(function (results) {
      testUtils.contains([{
        user_id: userId,
        role_id: userUtils.roleIds['user-uuid']
      }], results.rows);
    });
  });

  it('should prohibit adding user role if no role access', function () {
    return userUtils.createUser(userUtils.userUUID, 'user', 'secret').then(function () {
      // Lockdown policy for role's users
      return userUtils.setPolicy(policy, '$rubrole');
    }).then(function () {
      var changedByUUID = null;
      return userUtils.addUserRole(userUtils.userUUID, 'brole', changedByUUID);
    }).then(function () {
      return userUtils.getRoleIds();
    }).then(function () {
      utils.notDefined(userUtils.roleIds.brole).should.eql(true);
    }).then(function () {
      return findUserRoles();
    }).then(function (results) {
      testUtils.contains([{
        user_id: userId,
        role_id: userUtils.roleIds['user-uuid']
      }], results.rows);
    });
  });

  it('should prohibit removing user role if no user access', function () {
    return userUtils.createUser(userUtils.userUUID, 'user', 'secret').then(function () {
      return userUtils.addUserRole(userUtils.userUUID, 'brole', userUtils.userUUID);
    }).then(function () {
      // Lockdown policy for user's roles
      return userUtils.setPolicy(policy, '$role' + userUtils.userUUID);
    }).then(function () {
      var changedByUUID = null;
      return userUtils.removeUserRole(userUtils.userUUID, 'brole', changedByUUID);
    }).then(function () {
      return userUtils.getRoleIds();
    }).then(function () {
      return findUserRoles();
    }).then(function (results) {
      testUtils.contains([{
        user_id: userId,
        role_id: userUtils.roleIds['user-uuid']
      }, {
        user_id: userId,
        role_id: userUtils.roleIds['brole']
      }], results.rows);
    });
  });

  it('should prohibit removing user role if no role access', function () {
    return userUtils.createUser(userUtils.userUUID, 'user', 'secret').then(function () {
      return userUtils.addUserRole(userUtils.userUUID, 'brole', userUtils.userUUID);
    }).then(function () {
      // Lockdown policy for role's users
      return userUtils.setPolicy(policy, '$rubrole');
    }).then(function () {
      var changedByUUID = null;
      return userUtils.removeUserRole(userUtils.userUUID, 'brole', changedByUUID);
    }).then(function () {
      return userUtils.getRoleIds();
    }).then(function () {
      return findUserRoles();
    }).then(function (results) {
      testUtils.contains([{
        user_id: userId,
        role_id: userUtils.roleIds['user-uuid']
      }, {
        user_id: userId,
        role_id: userUtils.roleIds['brole']
      }], results.rows);
    });
  });

  it('should ignore cached roles', function () {
    args.db._process._roleIds = {
      '$rrole-name': 1
    }; // mock
    return args.db._process._cacheRoleIds({
      attr_name: '$role',
      attr_val: JSON.stringify({
        roleName: 'role-name'
      })
    });
  });

});
