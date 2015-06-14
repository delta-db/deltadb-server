'use strict';

/* global before, after */

var partDir = '../../../../scripts/partitioner/sql',
  partUtils = require('./utils'),
  constants = require(partDir + '/constants'),
  Users = require(partDir + '/user/users'),
  Roles = require(partDir + '/roles'),
  DocRecs = require(partDir + '/doc/doc-recs'),
  Cols = require(partDir + '/col/cols'),
  Manager = require(partDir + '/../../manager'),
  Item = require(partDir + '/../../client/item');

describe('policy', function () {

  var args = partUtils.init(this, beforeEach, afterEach, false, before, after);
  var testUtils = args.utils;

  var truncate = function () {
    return docs.truncateTable().then(function () {
      return args.db._userRoles.truncateTable();
    }).then(function () {
      return args.db._users.truncateTable();
    }).then(function () {
      return args.db._colRoles.truncateTable();
    });
  };

  var userUtils = null,
    userId = null,
    roleId = null,
    colId = null,
    docs = null,
    policy = null;
  beforeEach(function () {
    userUtils = args.userUtils;
    userId = Users.ID_LAST_RESERVED + 1;
    roleId = Roles.ID_LAST_RESERVED + 1;
    colId = 1;
    docs = args.db._partitions[constants.LATEST]._docs;
    policy = args.db._policy;
    return truncate();
  });

  var variationsShouldFail = function (attrName) {
    return policy.hasColRole(userId, constants.ACTION_UPDATE, colId, 'doc-uuid', attrName)
      .then(function (has) {
        has.should.eql(false); // fails as action different
      }).then(function () {
        return policy.hasColRole(userId, constants.ACTION_CREATE, colId + 1, 'doc-uuid',
          attrName);
      }).then(function (has) {
        has.should.eql(false); // fails as colId different
      }).then(function () {
        return policy.hasColRole(userId + 1, constants.ACTION_CREATE, colId, 'doc-uuid',
          attrName);
      }).then(function (has) {
        has.should.eql(false); // fails as userId different
      });
  };

  it('hasColRole for col', function () {
    return args.db._users.create('user-uuid', 'user', 'salt', 'secret', 'enabled', new Date())
      .then(function () {
        return args.db._userRoles.create(userId, roleId);
      }).then(function () {
        return args.db._colRoles.create(colId, null, roleId, constants.ACTION_CREATE, new Date());
      }).then(function () {
        return policy.hasColRole(userId, constants.ACTION_CREATE, colId, 'doc-uuid', null);
      }).then(function (has) {
        has.should.eql(true);
      }).then(function () {
        return variationsShouldFail(null);
      });
  });

  it('hasColRole for col when owner', function () {
    return args.db._users.create('user-uuid', 'user', 'salt', 'secret', 'enabled', new Date())
      .then(function () {
        return args.db._colRoles.create(colId, null, Roles.ID_OWNER, constants.ACTION_CREATE,
          new Date());
      }).then(function () {
        return docs.create('doc-uuid', colId, userId, null, null, new Date());
      }).then(function () {
        return policy.hasColRole(userId, constants.ACTION_CREATE, colId, 'doc-uuid', null);
      }).then(function (has) {
        has.should.eql(true);
      }).then(function () {
        return policy.hasColRole(userId, constants.ACTION_CREATE, colId, 'doc-uuid2',
          null);
      }).then(function (has) {
        has.should.eql(false); // fails as diff doc
      }).then(function () {
        return variationsShouldFail(null);
      });
  });

  it('hasColRole for attr', function () {
    return args.db._users.create('user-uuid', 'user', 'salt', 'secret', 'enabled', new Date())
      .then(function () {
        return args.db._userRoles.create(userId, roleId);
      }).then(function () {
        return args.db._colRoles.create(colId, 'attr-name', roleId, constants.ACTION_CREATE,
          new Date());
      }).then(function () {
        return policy.hasColRole(userId, constants.ACTION_CREATE, colId, 'doc-uuid',
          'attr-name');
      }).then(function (has) {
        has.should.eql(true);
      }).then(function () {
        return policy.hasColRole(userId, constants.ACTION_CREATE, colId, 'doc-uuid',
          'attr-name2');
      }).then(function (has) {
        has.should.eql(false); // fails as attrName different
      }).then(function () {
        return variationsShouldFail('attr-name');
      });
  });

  it('hasColRole for attr when owner', function () {
    return args.db._users.create('user-uuid', 'user', 'salt', 'secret', 'enabled', new Date())
      .then(function () {
        return args.db._colRoles.create(colId, 'attr-name', Roles.ID_OWNER, constants.ACTION_CREATE,
          new Date());
      }).then(function () {
        return docs.create('doc-uuid', colId, userId, null, null, new Date());
      }).then(function () {
        return policy.hasColRole(userId, constants.ACTION_CREATE, colId, 'doc-uuid',
          'attr-name');
      }).then(function (has) {
        has.should.eql(true);
      }).then(function () {
        return policy.hasColRole(userId, constants.ACTION_CREATE, colId, 'doc-uuid2',
          'attr-name');
      }).then(function (has) {
        has.should.eql(false); // fails as diff doc
      }).then(function () {
        return policy.hasColRole(userId, constants.ACTION_CREATE, colId, 'doc-uuid',
          'attr-name2');
      }).then(function (has) {
        has.should.eql(false); // fails as diff attr
      }).then(function () {
        return variationsShouldFail(null);
      });
  });

  it('modPermitted should permit if no col or attr policy', function () {
    return policy.modPermitted(null, constants.ACTION_CREATE, colId, 'doc-uuid', null)
      .then(function (has) {
        has.should.eql(true);
      });
  });

  it('modPermitted should permit if has col role', function () {
    return args.db._users.create('user-uuid', 'user', 'salt', 'secret', 'enabled', new Date())
      .then(function () {
        return args.db._userRoles.create(userId, roleId);
      }).then(function () {
        return args.db._colRoles.create(colId, null, roleId, constants.ACTION_CREATE, new Date());
      }).then(function () {
        return policy.modPermitted(userId, constants.ACTION_CREATE, colId, 'doc-uuid',
          'attr-name');
      }).then(function (has) {
        has.should.eql(true);
      }).then(function () {
        return policy.modPermitted(userId, constants.ACTION_CREATE, colId, 'doc-uuid',
          null);
      }).then(function (has) {
        has.should.eql(true);
      });
  });

  it('modPermitted should permit if no col role but has attr role', function () {
    var roleId2 = roleId + 1;
    return args.db._users.create('user-uuid', 'user', 'salt', 'secret', 'enabled', new Date())
      .then(function () {
        return args.db._userRoles.create(userId, roleId);
      }).then(function () {
        // col policy - not user's role
        return args.db._colRoles.create(colId, null, roleId2, constants.ACTION_CREATE,
          new Date());
      }).then(function () {
        // attr policy
        return args.db._colRoles.create(colId, 'attr-name', roleId, constants.ACTION_CREATE,
          new Date());
      }).then(function () {
        return policy.modPermitted(userId, constants.ACTION_CREATE, colId, 'doc-uuid',
          'attr-name');
      }).then(function (has) {
        has.should.eql(true);
      });
  });

  it('modPermitted should permit if has better col role', function () {
    var roleId2 = roleId + 1;
    return args.db._users.create('user-uuid', 'user', 'salt', 'secret', 'enabled', new Date())
      .then(function () {
        return args.db._userRoles.create(userId, roleId);
      }).then(function () {
        return args.db._userRoles.create(userId, roleId2);
      }).then(function () {
        // col policy
        return args.db._colRoles.create(colId, null, roleId2, constants.ACTION_CREATE,
          new Date());
      }).then(function () {
        return policy.modPermitted(userId, constants.ACTION_CREATE, colId, 'doc-uuid',
          'attr-name');
      }).then(function (has) {
        has.should.eql(true);
      }).then(function () {
        return policy.modPermitted(userId, constants.ACTION_CREATE, colId, 'doc-uuid',
          null);
      }).then(function (has) {
        has.should.eql(true);
      });
  });

  it('modPermitted should permit if has better attr role', function () {
    var roleId2 = roleId + 1;
    return args.db._users.create('user-uuid', 'user', 'salt', 'secret', 'enabled', new Date())
      .then(function () {
        return args.db._userRoles.create(userId, roleId);
      }).then(function () {
        return args.db._userRoles.create(userId, roleId2);
      }).then(function () {
        return args.db._colRoles.create(colId, 'attr-name', roleId2, constants.ACTION_CREATE,
          new Date());
      }).then(function () {
        return policy.modPermitted(userId, constants.ACTION_CREATE, colId, 'doc-uuid',
          'attr-name');
      }).then(function (has) {
        has.should.eql(true);
      });
  });

  it('modPermitted should permit if has col role and missing attr role', function () {
    var roleId2 = roleId + 1;
    return args.db._users.create('user-uuid', 'user', 'salt', 'secret', 'enabled', new Date())
      .then(function () {
        return args.db._userRoles.create(userId, roleId);
      }).then(function () {
        // col policy
        return args.db._colRoles.create(colId, null, roleId, constants.ACTION_CREATE,
          new Date());
      }).then(function () {
        // attr policy
        return args.db._colRoles.create(colId, 'attr-name', roleId2, constants.ACTION_CREATE,
          new Date());
      }).then(function () {
        return policy.modPermitted(userId, constants.ACTION_CREATE, colId, 'doc-uuid',
          'attr-name2');
      }).then(function (has) {
        has.should.eql(true);
      });
  });

  it('modPermitted should prohibit if no col role and no attr role', function () {
    return args.db._users.create('user-uuid', 'user', 'salt', 'secret', 'enabled', new Date())
      .then(function () {
        return args.db._userRoles.create(userId, roleId);
      }).then(function () {
        // col policy
        return args.db._colRoles.create(colId, null, roleId, constants.ACTION_CREATE, new Date());
      }).then(function () {
        // attr policy
        return args.db._colRoles.create(colId, 'attr-name', roleId, constants.ACTION_CREATE,
          new Date());
      }).then(function () {
        userId = -1; // simulate user w/o role
        return policy.modPermitted(userId, constants.ACTION_CREATE, colId, 'doc-uuid',
          null);
      }).then(function (has) {
        has.should.eql(false);
      }).then(function () {
        return policy.modPermitted(userId, constants.ACTION_CREATE, colId, 'doc-uuid',
          'attr-name');
      }).then(function (has) {
        has.should.eql(false);
      });
  });

  it('modPermitted should permit if super and no col role and no attr role', function () {
    return args.db._users.create('user-uuid', 'user', 'salt', 'secret', 'enabled', new Date())
      .then(function () {
        return args.db._userRoles.create(userId, roleId);
      }).then(function () {
        // col policy
        return args.db._colRoles.create(colId, null, roleId, constants.ACTION_CREATE, new Date());
      }).then(function () {
        // attr policy
        return args.db._colRoles.create(colId, 'attr-name', roleId, constants.ACTION_CREATE,
          new Date());
      }).then(function () {
        userId = Users.ID_SUPER; // simulate super user w/o role
        return policy.modPermitted(userId, constants.ACTION_CREATE, colId, 'doc-uuid',
          null);
      }).then(function (has) {
        has.should.eql(true);
      }).then(function () {
        return policy.modPermitted(userId, constants.ACTION_CREATE, colId, 'doc-uuid',
          'attr-name');
      }).then(function (has) {
        has.should.eql(true);
      });
  });

  it('should get policy', function () {
    var pol = {

      col: {
        create: 'role1',
        read: ['role1', 'role2'],
        update: null
          // destroy: 
      },

      attrs: {
        priority: {
          create: ['role1', 'role2'],
          read: null,
          // update: 
          destroy: 'role1'
        }
      }

    };
    var docId = DocRecs.ID_LAST_RESERVED + 1,
      name = '$policy',
      changedByUserId = null,
      recordedAt = null,
      updatedAt = new Date(),
      seq = null,
      restore = null,
      quorum = null,
      colId = Cols.ID_LAST_RESERVED + 1,
      changedByUUID = null;
    return policy.setPolicy(docId, name, pol, changedByUserId, recordedAt, updatedAt, seq,
      restore, quorum, colId, changedByUUID).then(function () {
      return policy.getPolicy(colId);
    }).then(function (_policy) {
      // getPolicy treats undefined and null as the same
      delete pol.col.update;
      delete pol.attrs.priority.read;
      _policy.should.eql(pol);
    });
  });

  it('should default super role policy', function () {
    var pol = {
      col: {
        create: '$super',
        read: '$super',
        update: '$super',
        destroy: '$super'
      }
    };
    return policy.getPolicy(Cols.ID_ROLE_USERS_SUPER).then(function (_policy) {
      _policy.should.eql(pol);
    }).then(function () {
      return policy.getPolicy(Cols.ID_USER_ROLES_SUPER);
    }).then(function (_policy) {
      _policy.should.eql(pol);
    });
  });

  it('should permit super even if author missing role', function () {
    var manager = new Manager(args.db);

    var changes = [{
      col: 'task',
      id: '1',
      name: 'priority',
      val: '"high"',
      up: '2014-01-01T10:00:00.000Z',
      uid: userUtils.userUUID
    }];

    return userUtils.createUser(userUtils.userUUID, 'user', 'secret').then(function () {
      return testUtils.queueAndProcess(args.db, changes, true);
    }).then(function () {
      return testUtils.changes(manager._partitioner, null, null, null, null, true,
        userUtils.userUUID);
    }).then(function (changes) {
      testUtils.contains(
        [{
          name: Item._policyName
        }, {
          name: Item._userName
        }, {
          name: 'priority',
          val: '"high"'
        }], testUtils.sortChanges(changes));
    }).then(function () {
      changes[0].val = '"low"';
      changes[0].uid = 'another-uuid'; // simulate missing role
      return testUtils.queueAndProcess(args.db, changes, true, Users.SUPER_UUID);
    }).then(function () {
      return testUtils.changes(manager._partitioner, null, null, null, null, true,
        Users.SUPER_UUID);
    }).then(function (changes) {
      testUtils.contains(
        [{
          name: Item._policyName
        }, {
          name: Item._userName
        }, {
          name: 'priority',
          val: '"low"'
        }], testUtils.sortChanges(changes));
    });
  });

  it('should build empty policy', function () {
    policy._buildPolicy();
  });

});