'use strict';

/* global before, after */

var partDir = '../../../../../scripts/partitioner/sql';

var partUtils = require('../utils'),
  Cols = require(partDir + '/col/cols'),
  Roles = require(partDir + '/roles');

describe('db', function () {

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
          },
          //          { id: Roles.ID_ADMIN, uuid: '$r$admin' },
          {
            id: Roles.ID_OWNER,
            uuid: '$r$owner'
          }, {
            id: Roles.ID_ALL,
            uuid: '$r$all'
          }
        ];
        var roles = systemRoles.concat(userRoles);
        testUtils.contains(roles, results.rows);
        results.rows.forEach(function (row) {
          roleIds[args.db._roles.toName(row.uuid)] = row.id;
        });
      });
  };

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

});