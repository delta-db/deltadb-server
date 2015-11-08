'use strict';

// TODO: also test filtering of users & policies

var DeltaDB = require('../../scripts/client/delta-db'),
  config = require('../../config'),
  utils = require('../../scripts/utils'),
  clientUtils = require('../../scripts/client/utils'),
  Doc = require('../../scripts/client/doc');

/**
 * The goal of this test is to make sure that we filter system DB deltas so that a client receives
 * only system deltas it generates and doesn't receive all system deltas. E.G. if client A creates
 * 'mydb', we don't want client B to receive this notification as we could have many DBs and don't
 * want each client to download all the DB names.
 */
describe('system', function () {

  // A lot of time is needed as we destroy and create the dbs several times. Unfortunately, it
  // appears that mocha doesn't support embedding this in a before() or beforeEach().
  this.timeout(20000);

  var dbsCreated = [],
    dbsDestroyed = [],
    pol = null,
    policies = [];

  var create = function (dbName) {
    var db = new DeltaDB(dbName, config.URL);
    var tasks = db.col('tasks');
    var task = tasks.doc({
      thing: 'write'
    });
    task.save();

    // Waiting for the following event ensures that the DB has already been created
    return utils.once(task, 'doc:record').then(function () {
      return db;
    });
  };

  var policy = function (db, attrName) {

    // We use an attr policy as we already have a default policy defined for our col
    pol = {
      col: {
        create: '$all',
        read: '$all',
        update: '$all',
        destroy: '$all'
      },
      attrs: {}
    };

    // Vary the attrName so that we don't define a policy that is already defined
    pol.attrs[attrName] = {
      create: '$all',
      read: '$all',
      update: '$all',
      destroy: '$all'
    };

    return DeltaDB._systemDB().policy('$db', pol).then(function (doc) {
      return utils.once(doc, 'doc:record');
    }).then(function () {
      return db;
    });
  };

  var destroy = function (db) {
    return db.destroy().then(function () {
      return DeltaDB._systemDB().destroy(true, false);
    }).then(function () {
      // TODO: remove this after we have a system db per db
      // Set to null to force creation of a new system DB
      DeltaDB._clearSystemDB();

      return db;
    });
  };

  beforeEach(function () {
    return create('mydb').then(function (db) {
      return policy(db, 'thing');
    }).then(function (db) {
      return destroy(db);
    });
  });

  it('should filter system deltas', function () {
    var systemDB = DeltaDB._systemDB();

    systemDB.on('doc:create', function (doc) {
      var data = doc.get();

      var dbName = data[clientUtils.DB_ATTR_NAME];
      if (dbName && typeof dbName === 'string') { // db created?
        dbsCreated.push(dbName);
      }

      var policy = data[Doc._policyName];
      if (policy) { // db created?
        policies.push(policy);
      }

    });

    systemDB.on('doc:destroy', function (doc) {
      var data = doc.get();

      var dbName = data[clientUtils.DB_ATTR_NAME];

      if (dbName && typeof dbName === 'string') { // db destroyed?
        dbsDestroyed.push(dbName);
      }

    });

    return create('myotherdb').then(function (db) {
      return policy(db, 'priority');
    }).then(function (db) {
      return destroy(db);
    }).then(function () {

      // Make sure we only received the 2nd db create/destroy
      dbsCreated.should.eql(['myotherdb']);
      dbsDestroyed.should.eql(['myotherdb']);

      // Make sure we only received the 2nd policy
      policies[0].should.eql(pol);

      return null; // prevent runaway promise errors
    });
  });

});
