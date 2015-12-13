'use strict';

/* global before, after */

// TODO: $super user can CRUD even if no policy

// TODO: split into smaller files

var partDir = '../../../../../scripts/partitioner/sql';

var partUtils = require('../utils'),
  Cols = require(partDir + '/col/cols'),
  Docs = require(partDir + '/doc/doc-recs'),
  testUtils = require('../../../../utils');

describe('policy', function () {

  var args = partUtils.init(this, beforeEach, afterEach, null, before, after);

  var userUtils = null; // for convenience
  beforeEach(function () {
    // args.userUtils is no instantiated
    testUtils.docId = Docs.ID_LAST_RESERVED + 4; // after $policy, $user and $role
    userUtils = args.userUtils;
  });

  afterEach(function () {
    testUtils.docId = Docs.ID_LAST_RESERVED + 2; // restore to default for other tests
  });

  // TODO: refactor not to run through process() and move to ../policy.js
  it('should default policies when not authenticated', function () {
    var changes = [{
      col: 'task',
      id: '1',
      name: 'priority',
      val: '"high"',
      up: '2014-01-01T10:00:00.000Z'
    }];

    var colRoles = function (roleIds) {
      return args.db._sql.find(null, 'col_roles', null, null, [
          ['col_id', 'asc'],
          ['name', 'asc'],
          ['action', 'asc'],
          ['role_id', 'asc']
        ])
        .then(function (results) {
          var superRoleColId = Cols.ID_ROLE_USERS_SUPER,
            superUserColId = Cols.ID_USER_ROLES_SUPER;
          testUtils.contains([

            // DB policy
            {
              col_id: Cols.ID_ALL,
              name: null,
              role_id: roleIds.$all,
              action: 'create'
            }, {
              col_id: Cols.ID_ALL,
              name: null,
              role_id: roleIds.$all,
              action: 'read'
            }, {
              col_id: Cols.ID_ALL,
              name: null,
              role_id: roleIds.$all,
              action: 'update'
            }, {
              col_id: Cols.ID_ALL,
              name: null,
              role_id: roleIds.$all,
              action: 'destroy'
            },

            // Col policy for super role
            {
              col_id: superRoleColId,
              name: null,
              role_id: roleIds.$super,
              action: 'create'
            }, {
              col_id: superRoleColId,
              name: null,
              role_id: roleIds.$super,
              action: 'read'
            }, {
              col_id: superRoleColId,
              name: null,
              role_id: roleIds.$super,
              action: 'update'
            }, {
              col_id: superRoleColId,
              name: null,
              role_id: roleIds.$super,
              action: 'destroy'
            },

            // Col policy for super user
            {
              col_id: superUserColId,
              name: null,
              role_id: roleIds.$super,
              action: 'create'
            }, {
              col_id: superUserColId,
              name: null,
              role_id: roleIds.$super,
              action: 'read'
            }, {
              col_id: superUserColId,
              name: null,
              role_id: roleIds.$super,
              action: 'update'
            }, {
              col_id: superUserColId,
              name: null,
              role_id: roleIds.$super,
              action: 'destroy'
            },

            // Col policy for task
            {
              col_id: testUtils.colId,
              name: null,
              role_id: roleIds.$all,
              action: 'create'
            }, {
              col_id: testUtils.colId,
              name: null,
              role_id: roleIds.$all,
              action: 'read'
            }, {
              col_id: testUtils.colId,
              name: null,
              role_id: roleIds.$all,
              action: 'update'
            }, {
              col_id: testUtils.colId,
              name: null,
              role_id: roleIds.$all,
              action: 'destroy'
            }
          ], results.rows);
        });
    };

    return args.db.truncateDatabase().then(function () {
      return testUtils.queueAndProcess(args.db, changes, true);
    }).then(function () {
      return userUtils.getRoleIds();
    }).then(function (roleIds) {
      return colRoles(roleIds);
    });
  });

  // TODO: refactor not to run through process() and move to ../policy.js
  it('should default policies when authenticated', function () {
    var changes = [{
      col: 'task',
      id: '1',
      name: 'priority',
      val: '"high"',
      up: '2014-01-01T10:00:00.000Z',
      uid: userUtils.userUUID
    }];

    var colRoles = function (roleIds) {
      return args.db._sql.find(null, 'col_roles', null, null, [
          ['col_id', 'asc'],
          ['name', 'asc'],
          ['action', 'asc'],
          ['role_id', 'asc']
        ])
        .then(function (results) {
          var role = userUtils.userUUID,
            roleId = roleIds[role];
          var superRoleColId = Cols.ID_ROLE_USERS_SUPER,
            superUserColId = Cols.ID_USER_ROLES_SUPER;
          testUtils.contains([

            // DB policy
            {
              col_id: Cols.ID_ALL,
              name: null,
              role_id: roleId,
              action: 'create'
            }, {
              col_id: Cols.ID_ALL,
              name: null,
              role_id: roleId,
              action: 'read'
            }, {
              col_id: Cols.ID_ALL,
              name: null,
              role_id: roleId,
              action: 'update'
            }, {
              col_id: Cols.ID_ALL,
              name: null,
              role_id: roleId,
              action: 'destroy'
            },

            // Col policy for super role
            {
              col_id: superRoleColId,
              name: null,
              role_id: roleIds.$super,
              action: 'create'
            }, {
              col_id: superRoleColId,
              name: null,
              role_id: roleIds.$super,
              action: 'read'
            }, {
              col_id: superRoleColId,
              name: null,
              role_id: roleIds.$super,
              action: 'update'
            }, {
              col_id: superRoleColId,
              name: null,
              role_id: roleIds.$super,
              action: 'destroy'
            },

            // Col policy for super user
            {
              col_id: superUserColId,
              name: null,
              role_id: roleIds.$super,
              action: 'create'
            }, {
              col_id: superUserColId,
              name: null,
              role_id: roleIds.$super,
              action: 'read'
            }, {
              col_id: superUserColId,
              name: null,
              role_id: roleIds.$super,
              action: 'update'
            }, {
              col_id: superUserColId,
              name: null,
              role_id: roleIds.$super,
              action: 'destroy'
            },

            // Col policy for user's roles
            {
              col_id: testUtils.colId,
              name: null,
              role_id: roleId,
              action: 'create'
            }, {
              col_id: testUtils.colId,
              name: null,
              role_id: roleId,
              action: 'read'
            }, {
              col_id: testUtils.colId,
              name: null,
              role_id: roleId,
              action: 'update'
            }, {
              col_id: testUtils.colId,
              name: null,
              role_id: roleId,
              action: 'destroy'
            },

            // Col policy for role's users
            {
              col_id: testUtils.colId + 1,
              name: null,
              role_id: roleId,
              action: 'create'
            }, {
              col_id: testUtils.colId + 1,
              name: null,
              role_id: roleId,
              action: 'read'
            }, {
              col_id: testUtils.colId + 1,
              name: null,
              role_id: roleId,
              action: 'update'
            }, {
              col_id: testUtils.colId + 1,
              name: null,
              role_id: roleId,
              action: 'destroy'
            },

            // Col policy for task
            {
              col_id: testUtils.colId + 2,
              name: null,
              role_id: roleId,
              action: 'create'
            }, {
              col_id: testUtils.colId + 2,
              name: null,
              role_id: roleId,
              action: 'read'
            }, {
              col_id: testUtils.colId + 2,
              name: null,
              role_id: roleId,
              action: 'update'
            }, {
              col_id: testUtils.colId + 2,
              name: null,
              role_id: roleId,
              action: 'destroy'
            }
          ], results.rows);
        });
    };

    return args.db.truncateDatabase().then(function () {
      return testUtils.queueAndProcess(args.db, changes, true);
    }).then(function () {
      return userUtils.getRoleIds();
    }).then(function (roleIds) {
      return colRoles(roleIds);
    });
  });

});
