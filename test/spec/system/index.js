'use strict';

// TODO: generalize for any Partitioner

// TODO: system shouldn't dep on sql

var testUtils = require('../../utils'),
  Cols = require('../../../scripts/partitioner/sql/col/cols'),
  Partitioner = require('../../../scripts/partitioner/sql'),
  Manager = require('../../../scripts/manager'),
  System = require('../../../scripts/system'),
  Doc = require('../../../scripts/client/item');

describe('system', function () {

  testUtils.setUp(this);

  var partitioner = new Partitioner();
  var manager = new Manager(partitioner);
  var system = new System(manager);

  beforeEach(function () {
    return system.create();
  });

  afterEach(function () {
    return system.destroy();
  });

  var defaultPolicy = {
    col: {
      create: '$admin',
      read: '$admin',
      update: '$admin',
      destroy: '$admin'
    }
  };

  it('should create user, policy & db collection', function () {
    return testUtils.changes(system._manager._partitioner, null, null, null, null, true,
        System.DEFAULT_ADMIN_USER_UUID)
      .then(function (changes) {
        testUtils.sortChanges(changes);
        // console.log(changes);
        testUtils.contains(
          [
            // policy
            {
              col: Cols.ALL,
              name: Doc._policyName,
              val: JSON.stringify(defaultPolicy)
            },

            // db collection
            {
              col: System.DB_COLLECTION_NAME,
              name: 'name',
              val: JSON.stringify(System.DB_NAME),
              id: System.DB_COLLECTION_NAME
            },

            // $admin user
            {
              col: Doc._userName,
              name: Doc._userName
            }
          ], changes);
      });
  });

  it('should default admin role policy', function () {
    var pol = {
      col: {
        create: '$admin',
        read: '$admin',
        update: '$admin',
        destroy: '$admin'
      }
    };
    var policy = partitioner._policy;
    return partitioner._cols.getColId('$ru$admin').then(function (colId) {
      return policy.getPolicy(colId);
    }).then(function (_policy) {
      _policy.should.eql(pol);
    }).then(function () {
      return partitioner._cols.getColId('$ur$admin');
    }).then(function (colId) {
      return policy.getPolicy(colId);
    }).then(function (_policy) {
      _policy.should.eql(pol);
    });
  });

});