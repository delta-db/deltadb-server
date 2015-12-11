'use strict';

// TODO: generalize for any Partitioner

var testUtils = require('../../utils'),
  Partitioner = require('../../../scripts/partitioner/sql'),
  Manager = require('../../../scripts/manager'),
  UserUtils = require('../../user-utils'),
  System = require('../../../scripts/system'),
  DBMissingError = require('deltadb-common-utils/scripts/errors/db-missing-error');

describe('system', function () {

  var partitioner = null,
    manager = null,
    args = {},
    userUtils = new UserUtils(args),
    system = null;

  beforeEach(function () {
    partitioner = new Partitioner();
    args.db = partitioner;
    manager = new Manager(partitioner);
    system = new System(manager);
    var adminParty = true; // allow all to CRUD
    return system.create(adminParty);
  });

  afterEach(function () {
    return system.destroy().then(function () {
      return partitioner.destroyAnotherDatabase('myotherdb').catch(function (err) {
        // Ignore error in case trying to destroy after DB has already been destroyed
        if (!(err instanceof DBMissingError)) {
          throw err;
        }
      });
    }).then(function () {
      return partitioner.closeDatabase();
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
          name: '$action',
          val: JSON.stringify({
            action: 'add',
            name: 'myotherdb'
          })
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
      testUtils.contains(
        [
          // The delta that destroys the DB
          {
            name: '$action',
            val: JSON.stringify({
              action: 'remove',
              name: 'myotherdb'
            })
          },

          // The generated delta from creating the DB
          {
            name: '$db',
            val: JSON.stringify('myotherdb')
          }
        ], testUtils.sortChanges(changes));
    });
  });
});
