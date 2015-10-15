'use strict';

// TODO: generalize for any Partitioner

var testUtils = require('../../utils'),
  Partitioner = require('../../../scripts/partitioner/sql'),
  Manager = require('../../../scripts/manager'),
  UserUtils = require('../../user-utils'),
  System = require('../../../scripts/system'),
  utils = require('../../../scripts/utils');

describe('system', function () {

  testUtils.setUp(this);

  var partitioner = null,
    manager = null,
    args = {},
    userUtils = new UserUtils(args),
    system = null;

  var setAllAccess = function () {
    // Allow everyone to create, read or destroy a DB
    var policy = {
      col: {
        create: '$all',
        read: '$all',
        update: '$all',
        destroy: '$all'
      }
    };
    return userUtils.setPolicy(policy, '$db', null, '$admin');
  };

  beforeEach(function () {
    partitioner = new Partitioner();
    args.db = partitioner;
    manager = new Manager(partitioner);
    system = new System(manager);
    return system.create().then(function () {
      return setAllAccess();
    });
  });

  afterEach(function () {
    return system.destroy().then(function () {
      return partitioner.destroyAnotherDatabase('myotherdb').catch(function () {
        // Ignore error in case trying to destroy after DB has already been destroyed
      });
    });
  });

  it('should create database', function () {

    var userUUID = 'user-uuid',
      since = null;

    // Sleep 1 ms so we only consider changes from now
    return testUtils.timeout(1).then(function () {
      since = new Date();
      return userUtils.createDatabase('myotherdb', userUUID);
    }).then(function () {
      return testUtils.changes(manager._partitioner, since, null, null, null, true,
        userUUID);
    }).then(function (changes) {
      testUtils.contains(
        [{
          name: '$db',
          val: '"myotherdb"'
        }], testUtils.sortChanges(changes));
    });
  });

  it('should destroy database', function () {

    var userUUID = 'user-uuid',
      since = null,
      id = null;

    // Sleep 1 ms so we only consider changes from now
    return testUtils.timeout(1).then(function () {
      since = new Date();
      return userUtils.createDatabase('myotherdb', userUUID);
    }).then(function () {
      return testUtils.changes(manager._partitioner, since, null, null, null, true,
        userUUID);
    }).then(function (changes) {
      id = changes[0].id;
      return testUtils.timeout(1);
    }).then(function () {
      // Sleep 1 ms so we only consider changes from now
      since = new Date();
      return userUtils.destroyDatabase('myotherdb', userUUID);
    }).then(function () {
      return testUtils.changes(manager._partitioner, since, null, null, null, true,
        userUUID);
    }).then(function (changes) {
      changes[0].id.should.eql(id);
      utils.notDefined(changes[0].name).should.eql(true);
      utils.notDefined(changes[0].val).should.eql(true);
    });
  });
});