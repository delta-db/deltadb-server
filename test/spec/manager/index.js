'use strict';

// TODO: generalize for any Partitioner

var testUtils = require('../../utils'),
  Partitioner = require('../../../scripts/partitioner/sql'),
  Manager = require('../../../scripts/manager'),
  Doc = require('../../../scripts/client/item'),
  partUtils = require('../../../scripts/utils'),
  Cols = require('../../../scripts/partitioner/sql/col/cols'),
  SQL = require('../../../scripts/orm/sql/adapters/postgres'); // needs to be dynamic

describe('manager', function () {

  testUtils.setUp(this);

  var partitioner = null,
    manager = null;

  beforeEach(function () {
    partitioner = new Partitioner('testdb', new SQL());
    manager = new Manager(partitioner);
    return manager._partitioner.connect();
  });

  afterEach(function () {
    return manager._partitioner.truncateDatabase().then(function () {
      return manager._partitioner.closeDatabase();
    });
  });

  it('should create user', function () {
    var user = null;
    return manager.genUser('user-uuid', 'username', 'secret').then(function (_user) {
      user = _user;
      return manager.queueCreateUser('user-uuid', user);
    }).then(function () {
      return manager._partitioner.process();
    }).then(function () {
      return testUtils.changes(partitioner, null, null, null, null, true, 'user-uuid');
    }).then(function (changes) {
      testUtils.contains([{
          col: Doc._userName,
          name: Doc._userName,
          val: JSON.stringify(user)
        }],
        testUtils.sortChanges(changes));
    });
  });

  it('should update user', function () {
    var user = null,
      updatedUser = null;
    return manager.genUser('user-uuid', 'username', 'secret').then(function (_user) {
      user = _user;
      return manager.queueCreateUser('user-uuid', user);
    }).then(function () {
      return manager._partitioner.process();
    }).then(function () {
      updatedUser = partUtils.clone(user);
      updatedUser.username = 'newusername';
      updatedUser.password = 'newpwd';
      // updatedUser.status = 'disabled'; // if we disable the user then we need to allow all policy
      return manager.queueUpdateUser('user-uuid', updatedUser);
    }).then(function () {
      return manager._partitioner.process();
    }).then(function () {
      return testUtils.changes(partitioner, null, null, null, null, true, 'user-uuid');
    }).then(function (changes) {
      testUtils.contains([{
          col: Doc._userName,
          name: Doc._userName,
          val: JSON.stringify(updatedUser)
        }],
        testUtils.sortChanges(changes));
    });
  });

  it('should add role', function () {
    return manager.genUserAndQueueCreateUser('user-uuid', 'username', 'secret').then(
      function () {
        return manager.queueAddRole('user-uuid', 'some-role');
      }).then(function () {
      return manager._partitioner.process();
    }).then(function () {
      return testUtils.changes(manager._partitioner, null, null, null, null, true,
        'user-uuid');
    }).then(function (changes) {
      // console.log(changes);
      var actionStr = JSON.stringify({
        action: 'add',
        userUUID: 'user-uuid',
        roleName: 'some-role'
      });
      testUtils.contains([{
        col: '$rusome-role',
        name: Doc._roleUserName,
        val: actionStr
      }, {
        col: '$uruser-uuid',
        name: Doc._roleName,
        val: actionStr
      }, {
        id: '$uuser-uuid',
        name: Doc._userName
      }], testUtils.sortChanges(changes));
    });
  });

  it('should remove role', function () {
    return manager.genUserAndQueueCreateUser('user-uuid', 'username', 'secret').then(
      function () {
        return manager.queueAddRole('user-uuid', 'some-role');
      }).then(function () {
      return manager._partitioner.process();
    }).then(function () {
      return manager.queueRemoveRole('user-uuid', 'some-role');
    }).then(function () {
      return manager._partitioner.process();
    }).then(function () {
      return testUtils.changes(manager._partitioner, null, null, null, null, true,
        'user-uuid');
    }).then(function (changes) {
      changes = testUtils.sortChanges(changes);
      var removeActionStr = JSON.stringify({
        action: 'remove',
        userUUID: 'user-uuid',
        roleName: 'some-role'
      });
      testUtils.contains([{
        col: '$rusome-role',
        name: Doc._roleUserName,
        val: removeActionStr
      }, {
        col: '$uruser-uuid',
        name: Doc._roleName,
        val: removeActionStr
      }, {
        id: '$uuser-uuid',
        name: Doc._userName
      }], changes);
    });
  });

  it('should set policy', function () {
    var policy = {
      col: {
        create: '$all',
        read: '$all',
        update: '$all',
        destroy: '$all'
      }
    };
    return manager.queueSetPolicy(policy, Cols.ID_ALL, 'policy-uuid').then(function () {
      return manager._partitioner.process();
    }).then(function () {
      return testUtils.changes(manager._partitioner, null, null, null, null, true);
    }).then(function (changes) {
      testUtils.contains(
        [{
          name: Doc._policyName,
          val: JSON.stringify(policy)
        }], testUtils.sortChanges(changes));
    });
  });

});