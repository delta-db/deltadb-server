'use strict';

/* global before, after */

var partDir = '../../../../../scripts/partitioner/sql';

var partUtils = require('../utils'),
  Roles = require(partDir + '/roles'),
  UserRoles = require(partDir + '/user/user-roles'),
  Users = require(partDir + '/user/users'),
  utils = require(partDir + '/../../utils'),
  SQLError = require('../../../../../scripts/orm/sql/common/sql-error'),
  MissingError = require('../../../../../scripts/orm/sql/common/missing-error'),
  AuthenticationError = require('../../../../../scripts/client/authentication-error');

describe('users', function () {

  var args = partUtils.init(this, beforeEach, afterEach, false, before, after);
  var testUtils = args.utils;

  var userUtils = null; // for convenience
  beforeEach(function () {
    userUtils = args.userUtils;
  });

  it('should create reserved users', function () {
    return args.db._sql.find(null, 'users', null, null, ['id', 'asc']).then(function (
      results) {
      testUtils.contains([{
        id: Users.ID_SUPER,
        uuid: Users.SUPER_UUID,
        username: Users.SUPER_USER
      }], results.rows);
    });
  });

  it('should create reserved users with different super username, password and salt', function () {
    Users.SUPER_USER = 'my-super';
    Users.SUPER_SALT = 'my-salt';
    Users.SUPER_PWD = 'my-pwd';
    // Truncate DB so that we simulate change in super user's info
    return args.db.truncateDatabase().then(function () {
      return args.db._sql.find(null, 'users', null, null, ['id', 'asc']);
    }).then(function (results) {
      testUtils.contains([{
        id: Users.ID_SUPER,
        uuid: Users.SUPER_UUID,
        username: Users.SUPER_USER,
        salt: Users.SUPER_SALT,
        password: Users.SUPER_PWD
      }], results.rows);
    });
  });

  it('should create user and implicit role', function () {
    return userUtils.createUser(userUtils.userUUID, 'user', 'secret').then(function () {}).then(
      function () {
        return args.db._sql.find(null, 'users', null, ['id', '>', Users.ID_LAST_RESERVED]);
      }).then(function (results) {
      testUtils.contains([{
        username: 'user'
      }], results.rows);
    }).then(function () {
      return args.db._sql.find(null, 'user_roles', null, ['id', '>', UserRoles.ID_LAST_RESERVED]);
    }).then(function (results) {
      testUtils.contains([{
        user_id: testUtils.userId,
        role_id: testUtils.roleId
      }], results.rows);
    });
  });

  it('should allow user to modify user they created', function () {
    // Create my account
    return userUtils.createUser(userUtils.userUUID, 'my-user', 'secret').then(function () {
      // Create their account
      return userUtils.createUser('their-uuid', 'their-user', 'secret', 'enabled',
        userUtils.userUUID);
    }).then(function () {
      // Modify their user
      return userUtils.updateUser('their-uuid', 'their-user', 'secret', 'disabled',
        userUtils.userUUID);
    }).then(function () {
      return args.db._sql.find(null, 'users', null, ['id', '>', Users.ID_LAST_RESERVED]);
    }).then(function (results) {
      testUtils.contains([{
        username: 'my-user'
      }, {
        username: 'their-user',
        status: 'disabled'
      }], results.rows);
    });
  });

  // TODO: problem with current setup is that cannot restrict access to doc except to owner. Is this
  // OK???
  // SOLUTIONS:
  // 1. Implement doc specific policies (FUTURE???)
  // 2. Create a col per user--then how to easily "query" for all users? Query based on regex for
  //    col names? (problem is that we cannot then allow users to create users w/o allowing
  //    creation of any collection!!)
  // 3. Require access to user's col to edit entry in $users, i.e. duplicate data in $users and col
  //    specific to user. Not great as then requires special logic just to manage these permissions
  // 4. Default policy for $users to owner so that only owner can edit (issue is that cannot give
  //    users access to some select group of users, it's all or nothing)--PROBABLY EASIEST FOR NOW
  it('should prohibit user from modifying another user', function () {

    var policy = {
      col: {
        create: Roles.ALL,
        read: Roles.OWNER,
        update: Roles.OWNER,
        destroy: Roles.OWNER
      }
    };

    // Allow anyone to create a user, but only the owner to modify the user
    return userUtils.setPolicy(policy, '$user').then(function () {
      // Create my account
      return userUtils.createUser(userUtils.userUUID, 'my-user', 'secret');
    }).then(function () {
      // Create their account
      var changedByUUID = 'their-uuid'; // As if user is creating own account
      return userUtils.createUser(changedByUUID, 'their-user', 'secret', 'enabled',
        changedByUUID);
    }).then(function () {
      // Attempt to modify their user
      return userUtils.updateUser('their-uuid', 'their-user', 'secret', 'disabled',
        userUtils.userUUID);
    }).then(function () {
      return args.db._sql.find(null, 'users', null, ['id', '>', Users.ID_LAST_RESERVED]);
    }).then(function (results) {
      // Update failed as their-user not created by my-user and therefore not allowed by default
      // policy
      testUtils.contains([{
        username: 'my-user'
      }, {
        username: 'their-user',
        status: 'enabled'
      }], results.rows);
    });
  });

  it('should add/remove role', function () {
    var userId = 1,
      updatedAt = new Date();
    return args.db._users.addRole(userId, 'role-uuid', userId, 'user-uuid', updatedAt)
      .then(function () {
        return userUtils.getRoleIds();
      }).then(function () {
        return args.db._sql.find(null, UserRoles.NAME, null, ['id', '>',
          UserRoles.ID_LAST_RESERVED
        ]);
      }).then(function (results) {
        testUtils.contains([{
          user_id: userId,
          role_id: userUtils.roleIds['role-uuid']
        }], results.rows);
      }).then(function () {
        return args.db._users.removeRole(userId, 'role-uuid');
      }).then(function () {
        return args.db._sql.find(null, UserRoles.NAME, null, ['id', '>',
          UserRoles.ID_LAST_RESERVED
        ]);
      }).then(function (results) {
        (results.rows === null).should.eql(true);
      });
  });

  it('should throw error when creating user', function () {
    args.db._users.createUserAndImplicitRole = testUtils.promiseErrorFactory(new Error(
      'err'));
    return testUtils.shouldThrow(function () {
      return args.db._users.createUserAndImplicitRoleOrGetId();
    }, new Error('err'));
  });

  it('should ignore sql error when creating user', function () {
    args.db._users.createUserAndImplicitRole = testUtils.promiseErrorFactory(new SQLError(
      'err'));
    return args.db._users.createUserAndImplicitRoleOrGetId();
  });

  it('should throw error when creating or updating user', function () {
    args.db._users.createUserAndImplicitRole = testUtils.promiseErrorFactory(new Error(
      'err'));
    return testUtils.shouldThrow(function () {
      return args.db._users.createUserAndImplicitRoleOrUpdateUser();
    }, new Error('err'));
  });

  it('should get user when missing', function () {
    return args.db._users.getUser(-1).then(function (user) {
      utils.notDefined(user).should.eql(true);
    });
  });

  it('should authenticate', function () {
    var userId = testUtils.userId;
    return userUtils.createUser(userUtils.userUUID, 'user', 'secret').then(function () {
      return args.db._users.authenticated('user', 'secret');
    }).then(function (user) {
      user.id.should.eql(userId);
    });
  });

  it('should authenticate with hashed password', function () {
    var userId = testUtils.userId;
    return userUtils.createUser(userUtils.userUUID, 'user', 'secret').then(function () {
      return args.db._users.getUser(userId);
    }).then(function (user) {
      return args.db._users.authenticated('user', null, user.password);
    }).then(function (user) {
      user.id.should.eql(userId);
    });
  });

  it('should throw if user missing when authenticating', function () {
    return testUtils.shouldThrow(function () {
      return args.db._users.authenticated('user', 'secret');
    }, new MissingError('user not found (username=user)'));
  });

  it('should throw if password incorrect when authenticating', function () {
    return userUtils.createUser(userUtils.userUUID, 'user', 'secret').then(function () {
      return testUtils.shouldThrow(function () {
        return args.db._users.authenticated('user', 'badsecret');
      }, new AuthenticationError('username (username=user) and/or password invalid'));
    });
  });

});
