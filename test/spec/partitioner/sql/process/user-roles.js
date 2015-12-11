'use strict';

var partDir = '../../../../../scripts/partitioner/sql';

var partUtils = require('../utils'),
  Promise = require('bluebird'),
  ForbiddenError = require(partDir + '/forbidden-error'),
  commonUtils = require('deltadb-common-utils');

describe('user-roles', function () {

  var noAll = false;
  var args = partUtils.init(this, beforeEach, afterEach, noAll, before, after);
  var testUtils = args.utils;

  beforeEach(function () {
    return args.db._cols.truncateTable();
  });

  var actionAddStr = JSON.stringify({
      action: 'add',
      userUUID: 'user-uuid',
      roleName: 'role-name'
    }),
    actionRemoveStr = JSON.stringify({
      action: 'remove',
      userUUID: 'user-uuid',
      roleName: 'role-name'
    });

  it('should remove user role delta if not authorized to create user', function () {
    var up = new Date();
    args.db._process._userIds = []; // mock no perm to create users
    args.db._process._deltas = [{
      col_name: '$uruser-uuid',
      attr_name: '$role',
      attr_val: '"role-name"',
      user_uuid: 'auth-uuid',
      updated_at: up
    }];
    return args.db._process._takeUserRoleInventoryForAttr(0).then(function () {
      args.db._process._deltas.should.eql([]);
    });
  });

  it('should take user role inventory when not authenticated', function () {
    args.db._process._deltas = [{
      col_name: '$uruser-uuid',
      attr_name: '$role',
      attr_val: actionAddStr,
      updated_at: new Date()
    }];
    return args.db._process._takeUserRoleInventoryForAttr(0).then(function () {
      // Make sure the role user delta is created as both the user and role need to be modified
      testUtils.contains([{
          col_name: '$uruser-uuid',
          attr_name: '$role',
          attr_val: actionAddStr
        }, {
          col_name: '$rurole-name',
          attr_name: '$ruser',
          attr_val: actionAddStr
        }],
        args.db._process._deltas);
      commonUtils.isDefined(args.db._process._deltas[0].doc_uuid).should.eql(true);
      args.db._process._deltas[1].doc_uuid.should.eql('$g' + args.db._process._deltas[0]
        .doc_uuid);
    });
  });

  it('should take user role inventory when authenticated', function () {
    args.db._process._userIds['auth-uuid'] = 100; // mock user creation

    args.db._process._canCreateDoc = function () { // mock perm
      return Promise.resolve(true);
    };

    args.db._process._deltas = [{
      col_name: '$uruser-uuid',
      attr_name: '$role',
      attr_val: actionAddStr,
      user_uuid: 'auth-uuid',
      updated_at: new Date()
    }];
    return args.db._process._takeUserRoleInventoryForAttr(0).then(function () {
      // Make sure the role user delta is created as both the user and role need to be modified
      testUtils.contains([{
          col_name: '$uruser-uuid',
          attr_name: '$role',
          attr_val: actionAddStr
        }, {
          col_name: '$rurole-name',
          attr_name: '$ruser',
          attr_val: actionAddStr
        }],
        args.db._process._deltas);
    });
  });

  it('should remove user role delta if not authorized to modify user roles', function () {
    args.db._process._canCreateCol = function (colName) { // mock perm
      return new Promise(function (resolve) {
        if (colName === '$uruser-uuid') {
          throw new ForbiddenError('cannot create col ' + colName);
        }
        resolve(true);
      });
    };

    args.db._process._deltas = [{
      col_name: '$uruser-uuid',
      attr_name: '$role',
      attr_val: actionAddStr,
      updated_at: new Date()
    }];
    return args.db._process._takeUserRoleInventoryForAttr(0).then(function () {
      args.db._process._deltas.should.eql([]); // attr should have been removed
    });
  });

  it('should remove user role delta if not authorized to modify role users', function () {
    args.db._process._canCreateCol = function (colName) { // mock perm
      return new Promise(function (resolve) {
        if (colName === '$rurole-name') {
          throw new ForbiddenError('cannot create col ' + colName);
        }
        resolve(true);
      });
    };

    args.db._process._deltas = [{
      col_name: '$uruser-uuid',
      attr_name: '$role',
      attr_val: actionAddStr,
      updated_at: new Date()
    }];
    return args.db._process._takeUserRoleInventoryForAttr(0).then(function () {
      args.db._process._deltas.should.eql([]); // attr should have been removed
    });
  });

  it('should remove user role delta if not authorized to destroy user role', function () {
    args.db._process._canDestroyAttr = function () { // mock perm
      return new Promise(function () {
        throw new ForbiddenError('cannot create attr');
      });
    };

    args.db._process._deltas = [ // remove user from role
      {
        col_name: '$uruser-uuid',
        attr_name: '$role',
        attr_val: actionRemoveStr,
        updated_at: new Date()
      }
    ];
    return args.db._process._takeUserRoleInventoryForAttr(0).then(function () {
      args.db._process._deltas.should.eql([]); // attr should have been removed
    });
  });

  it('should take user role inventory with recorded by user id', function () {
    args.db._process._getRecordedByUserId = function () {
      return 1;
    };
    args.db._process._deltas[0] = {
      col_name: 'col-name',
      attr_name: '$role',
      attr_val: JSON.stringify({
        roleName: 'role'
      })
    };
    return args.db._process._takeUserRoleInventoryForAttr(0);
  });

  it('should throw error taking user role inventory', function () {
    args.db._process._getRecordedByUserId = function () {
      return 1;
    };
    args.db._process._lookupOrCreateUserRoleColsIfPermitted = function () {
      return new Promise(function () {
        throw new Error('err');
      });
    };
    args.db._process._deltas[0] = {
      col_name: 'col-name',
      attr_name: '$role',
      attr_val: JSON.stringify({
        roleName: 'role'
      })
    };
    return testUtils.shouldThrow(function () {
      return args.db._process._takeUserRoleInventoryForAttr(0);
    }, new Error('err'));
  });

});
