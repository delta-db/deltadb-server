'use strict';

/* global before, after */

var partDir = '../../../../../scripts/partitioner/sql';

var partUtils = require('../utils'),
  Cols = require(partDir + '/col/cols'),
  Roles = require(partDir + '/roles');

describe('set-policy', function () {

  var args = partUtils.init(this, beforeEach, afterEach, null, before, after);
  var testUtils = args.utils;

  var userUtils = null; // for convenience
  beforeEach(function () {
    userUtils = args.userUtils;
  });

  var roleIds = {};

  var rolesShouldEql = function (userRoles) {
    return args.db._sql.find(null, 'roles', null, null, ['id', 'asc'])
      .then(function (results) {
        var systemRoles = [{
          id: Roles.ID_SUPER,
          uuid: '$r$super'
        }, {
          id: Roles.ID_OWNER,
          uuid: '$r$owner'
        }, {
          id: Roles.ID_ALL,
          uuid: '$r$all'
        }];
        var roles = systemRoles.concat(userRoles);
        testUtils.contains(roles, results.rows);
        results.rows.forEach(function (row) {
          roleIds[args.db._roles.toName(row.uuid)] = row.id;
        });
      });
  };

  it('should set col role when not authenticated', function () {
    var policy = {
      col: {
        create: 'poster'
      }
    };

    return userUtils.setPolicy(policy).then(function () {
      return rolesShouldEql([{
        uuid: '$rposter'
      }]);
    }).then(function () {
      var colRoles = [
        // Policy for poster
        {
          col_id: testUtils.colId,
          name: null,
          role_id: roleIds.poster,
          action: 'create'
        },

        // Policy for poster users
        // TODO: enhance so that role_id is set to roleIds.poster?
        {
          col_id: testUtils.colId + 1,
          name: null,
          role_id: roleIds.$all,
          action: 'create'
        }, {
          col_id: testUtils.colId + 1,
          name: null,
          role_id: roleIds.$all,
          action: 'read'
        }, {
          col_id: testUtils.colId + 1,
          name: null,
          role_id: roleIds.$all,
          action: 'update'
        }, {
          col_id: testUtils.colId + 1,
          name: null,
          role_id: roleIds.$all,
          action: 'destroy'
        }

      ];
      return testUtils.colRolesShouldEql(args.db, colRoles);
    });
  });

  it('should set col role when authenticated', function () {
    var policy = {
      col: {
        create: 'poster'
      }
    };

    return userUtils.setPolicy(policy, null, null, userUtils.userUUID).then(function () {
      return rolesShouldEql([{
        uuid: '$ruser-uuid'
      }, {
        uuid: '$rposter'
      }]);
    }).then(function () {
      var roleId = roleIds[userUtils.userUUID]; // implicit role
      var colRoles = [
        // Policy for poster
        {
          col_id: testUtils.colId,
          name: null,
          role_id: roleIds.poster,
          action: 'create'
        },

        // Policy for implicit role - user's roles
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

        // Policy for implicit role - role's users
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
        },

        // Policy for poster users
        // TODO: enhance so that role_id is set to roleIds.poster?
        {
          col_id: testUtils.colId + 3,
          name: null,
          role_id: roleId,
          action: 'create'
        }, {
          col_id: testUtils.colId + 3,
          name: null,
          role_id: roleId,
          action: 'read'
        }, {
          col_id: testUtils.colId + 3,
          name: null,
          role_id: roleId,
          action: 'update'
        }, {
          col_id: testUtils.colId + 3,
          name: null,
          role_id: roleId,
          action: 'destroy'
        }


      ];
      return testUtils.colRolesShouldEql(args.db, colRoles);
    });
  });

  it('should set db policy col role', function () {
    var policy = {
      col: {
        create: 'poster',
        read: 'poster'
      }
    };

    return userUtils.setPolicy(policy, Cols.ALL).then(function () {
      return rolesShouldEql([{
        uuid: '$rposter'
      }]);
    }).then(function () {
      var colRoles = [{
        col_id: Cols.ID_ALL,
        name: null,
        role_id: roleIds.poster,
        action: 'create'
      }, {
        col_id: Cols.ID_ALL,
        name: null,
        role_id: roleIds.poster,
        action: 'read'
      }];
      var where = ['col_id', '=', Cols.ID_ALL];
      return testUtils.colRolesShouldEql(args.db, colRoles, where);
    });
  });

  it('should set col owner role', function () {
    var policy = {
      col: {
        create: '$owner'
      }
    };

    return userUtils.setPolicy(policy).then(function () {
      return rolesShouldEql([]); // $owner is a reserved role
    }).then(function () {
      var colRoles = [{
        col_id: testUtils.colId,
        name: null,
        role_id: roleIds.$owner,
        action: 'create'
      }];
      return testUtils.colRolesShouldEql(args.db, colRoles);
    });
  });

  it('should set col roles', function () {
    var policy = {
      col: {
        create: ['poster', 'editor']
      }
    };

    return userUtils.setPolicy(policy).then(function () {
      return rolesShouldEql([{
        uuid: '$rposter'
      }, {
        uuid: '$reditor'
      }]);
    }).then(function () {
      var colRoles = [
        // Policy for poster
        {
          col_id: testUtils.colId,
          name: null,
          role_id: roleIds.poster,
          action: 'create'
        },

        // Policy for editor
        {
          col_id: testUtils.colId,
          name: null,
          role_id: roleIds.editor,
          action: 'create'
        },

        // Policy for poster users
        // TODO: enhance so that role_id is set to roleIds.poster?
        {
          col_id: testUtils.colId + 1,
          name: null,
          role_id: roleIds.$all,
          action: 'create'
        }, {
          col_id: testUtils.colId + 1,
          name: null,
          role_id: roleIds.$all,
          action: 'read'
        }, {
          col_id: testUtils.colId + 1,
          name: null,
          role_id: roleIds.$all,
          action: 'update'
        }, {
          col_id: testUtils.colId + 1,
          name: null,
          role_id: roleIds.$all,
          action: 'destroy'
        },

        // Policy for editor users
        // TODO: enhance so that role_id is set to roleIds.poster?
        {
          col_id: testUtils.colId + 2,
          name: null,
          role_id: roleIds.$all,
          action: 'create'
        }, {
          col_id: testUtils.colId + 2,
          name: null,
          role_id: roleIds.$all,
          action: 'read'
        }, {
          col_id: testUtils.colId + 2,
          name: null,
          role_id: roleIds.$all,
          action: 'update'
        }, {
          col_id: testUtils.colId + 2,
          name: null,
          role_id: roleIds.$all,
          action: 'destroy'
        }
      ];
      return testUtils.colRolesShouldEql(args.db, colRoles);
    });
  });

  it('should set attr role', function () {
    var policy = {
      attrs: {
        priority: {
          update: 'poster'
        }
      }
    };

    return userUtils.setPolicy(policy).then(function () {
      return rolesShouldEql([{
        uuid: '$rposter'
      }]);
    }).then(function () {
      var colRoles = [
        // Policy for poster
        {
          col_id: testUtils.colId,
          name: 'priority',
          role_id: roleIds.poster,
          action: 'update'
        },

        // Policy for poster users
        // TODO: enhance so that role_id is set to roleIds.poster?
        {
          col_id: testUtils.colId + 1,
          name: null,
          role_id: roleIds.$all,
          action: 'create'
        }, {
          col_id: testUtils.colId + 1,
          name: null,
          role_id: roleIds.$all,
          action: 'read'
        }, {
          col_id: testUtils.colId + 1,
          name: null,
          role_id: roleIds.$all,
          action: 'update'
        }, {
          col_id: testUtils.colId + 1,
          name: null,
          role_id: roleIds.$all,
          action: 'destroy'
        }
      ];
      return testUtils.colRolesShouldEql(args.db, colRoles);
    });
  });

  it('should set attr owner role', function () {
    var policy = {
      attrs: {
        priority: {
          update: '$owner'
        }
      }
    };

    return userUtils.setPolicy(policy).then(function () {
      return rolesShouldEql([]); // $owner is a reserved role
    }).then(function () {
      var colRoles = [{
        col_id: testUtils.colId,
        name: 'priority',
        role_id: roleIds.$owner,
        action: 'update'
      }, ];
      return testUtils.colRolesShouldEql(args.db, colRoles);
    });
  });

  it('should set attr roles', function () {
    var policy = {
      attrs: {
        priority: {
          update: ['poster', 'editor']
        }
      }
    };

    return userUtils.setPolicy(policy).then(function () {
      return rolesShouldEql([{
        uuid: '$rposter'
      }, {
        uuid: '$reditor'
      }]);
    }).then(function () {
      var colRoles = [
        // Policy for poster
        {
          col_id: testUtils.colId,
          name: 'priority',
          role_id: roleIds.poster,
          action: 'update'
        },

        // Policy for editor
        {
          col_id: testUtils.colId,
          name: 'priority',
          role_id: roleIds.editor,
          action: 'update'
        },

        // Policy for poster users
        // TODO: enhance so that role_id is set to roleIds.poster?
        {
          col_id: testUtils.colId + 1,
          name: null,
          role_id: roleIds.$all,
          action: 'create'
        }, {
          col_id: testUtils.colId + 1,
          name: null,
          role_id: roleIds.$all,
          action: 'read'
        }, {
          col_id: testUtils.colId + 1,
          name: null,
          role_id: roleIds.$all,
          action: 'update'
        }, {
          col_id: testUtils.colId + 1,
          name: null,
          role_id: roleIds.$all,
          action: 'destroy'
        },

        // Policy for editor users
        // TODO: enhance so that role_id is set to roleIds.poster?
        {
          col_id: testUtils.colId + 2,
          name: null,
          role_id: roleIds.$all,
          action: 'create'
        }, {
          col_id: testUtils.colId + 2,
          name: null,
          role_id: roleIds.$all,
          action: 'read'
        }, {
          col_id: testUtils.colId + 2,
          name: null,
          role_id: roleIds.$all,
          action: 'update'
        }, {
          col_id: testUtils.colId + 2,
          name: null,
          role_id: roleIds.$all,
          action: 'destroy'
        }
      ];
      return testUtils.colRolesShouldEql(args.db, colRoles);
    });
  });

});
