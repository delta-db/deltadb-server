'use strict';

/* global before, after */

var partUtils = require('../utils'),
  Promise = require('bluebird');

describe('users', function () {

  var args = partUtils.init(this, beforeEach, afterEach, null, before, after);
  var utils = args.utils;

  beforeEach(function () {
    return args.db._users.truncateTable();
  });

  it('should cache user for basic delta', function () {
    var attr = {
      attr_name: 'priority',
      attr_val: '"high"',
      user_uuid: 'user-uuid',
      updated_at: new Date()
    };
    return args.db._process._cacheUsersForAttr(attr).then(function () {
      args.db._process._userIds.should.eql({
        'user-uuid': utils.userId
      });
    });
  });

  it('should cache user for super delta', function () {
    var attr = {
      attr_name: 'priority',
      attr_val: '"high"',
      user_uuid: 'user-uuid',
      updated_at: new Date(),
      super_uuid: 'super-uuid'
    };
    return args.db._process._cacheUsersForAttr(attr).then(function () {
      args.db._process._userIds.should.eql({
        'super-uuid': utils.userId,
        'user-uuid': utils.userId + 1
      });
    });
  });

  it('should cache users for user delta', function () {
    var user = {
      uuid: 'user-uuid',
      username: 'username',
      status: 'enabled'
    };
    var attr = {
      col_name: '$user',
      attr_name: '$user',
      attr_val: JSON.stringify(user),
      user_uuid: 'auth-uuid',
      updated_at: new Date()
    };
    return args.db._process._cacheUsersForAttr(attr).then(function () {
      args.db._process._userIds.should.eql({
        'auth-uuid': utils.userId,
        'user-uuid': utils.userId + 1
      });
    });
  });

  it('should cache users for user role delta', function () {
    var attr = {
      col_name: '$uruser-uuid',
      attr_name: '$role',
      attr_val: '"role-name"',
      user_uuid: 'auth-uuid',
      updated_at: new Date()
    };
    return args.db._process._cacheUsersForAttr(attr).then(function () {
      args.db._process._userIds.should.eql({
        'auth-uuid': utils.userId,
        'user-uuid': utils.userId + 1
      });
    });
  });

  it('should ignore cached users when caching', function () {
    var up = new Date();
    var attr = {
      attr_name: 'priority',
      attr_val: '"high"',
      user_uuid: 'user-uuid',
      updated_at: up
    };
    args.db._process._userIds['user-uuid'] = null; // mock previous lookup
    return args.db._process._cacheUsersForAttr(attr).then(function () {
      args.db._process._userIds.should.eql({
        'user-uuid': null
      });
    });
  });

  it('should not create user when prohibited', function () {
    args.db._docs._canCreate = function () {
      return Promise.resolve(false);
    };
    // TODO: actually check, just for coverage now
    return args.db._process._createUser('user-uuid', new Date(), 'user-uuid');
  });

});
