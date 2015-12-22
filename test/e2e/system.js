'use strict';

var DeltaDB = require('deltadb/scripts/delta-db'),
  config = require('../../config'),
  commonUtils = require('deltadb-common-utils'),
  clientUtils = require('deltadb/scripts/utils'),
  Doc = require('deltadb/scripts/doc'),
  Promise = require('bluebird');

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

  var db = null,
    dbCreated = null,
    dbNames = [],
    dbsCreated = [],
    dbsDestroyed = [],
    pol = null,
    policiesCreated = [],
    policiesUpdated = [],
    usersCreated = [],
    usersUpdated = [],
    roleUsersCreated = [],
    roleUsersUpdated = [];

  var createDB = function (dbName) {
    db = new DeltaDB(dbName, config.url());
    var tasks = db.col('tasks');
    var task = tasks.doc({
      thing: 'write'
    });
    task.save();

    // Waiting for the following event ensures that the DB has already been created
    dbCreated = commonUtils.once(task, 'doc:record');

    return Promise.resolve();
  };

  var waitUntilDBCreated = function () {
    return dbCreated;
  };

  var destroyDB = function () {
    return db.destroy();
  };

  var policy = function (attrName) {

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

    return db._systemDB().policy('$db', pol).then(function (doc) {
      return commonUtils.once(doc, 'doc:record');
    });
  };

  var createUser = function (uuid, username) {
    return db._systemDB().createUser(uuid, username, 'secret', 'enabled').then(function (
      doc) {
      return commonUtils.once(doc, 'doc:record');
    });
  };

  var updateUser = function (uuid, username) {
    return db._systemDB().updateUser(uuid, username, 'secret', 'disabled').then(function (
      doc) {
      return commonUtils.once(doc, 'attr:record');
    });
  };

  var addRole = function (userUUID, roleName) {
    return db._systemDB().addRole(userUUID, roleName);
  };

  var removeRole = function (userUUID, roleName) {
    return db._systemDB().removeRole(userUUID, roleName);
  };

  beforeEach(function () {
    return createDB('mydb').then(function () {
      return waitUntilDBCreated();
    }).then(function () {
      return policy('thing');
    }).then(function () {
      return createUser('first-user-uuid', 'first-user');
    }).then(function () {
      return updateUser('first-user-uuid', 'first-user');
    }).then(function () {
      return addRole('first-user-uuid', 'first-role');
    }).then(function () {
      return removeRole('first-user-uuid', 'first-role');
    }).then(function () {
      return destroyDB();
    });
  });

  var registerCreateSystemListener = function () {
    db._systemDB().on('doc:create', function (doc) {

      var data = doc.get();

      var dbName = data[clientUtils.DB_ATTR_NAME];
      if (dbName && typeof dbName === 'string') { // db created?
        dbNames.push(dbName);
      }

      var policy = data[Doc._policyName];
      if (policy) { // db created?
        policiesCreated.push(policy);
      }

      var user = data[Doc._userName];
      if (user) { // user created?
        usersCreated.push(user);
      }

      var roleUser = data[Doc._roleName];
      if (roleUser) { // user added to role?
        roleUsersCreated.push(roleUser);
      }

    });
  };

  var registerUpdateSystemListener = function () {
    db._systemDB().on('doc:update', function (doc) {

      var data = doc.get();

      var dbName = data[clientUtils.DB_ATTR_NAME];
      if (dbName && typeof dbName === 'string') { // db created?
        dbNames.push(dbName);
      }

      var action = data[clientUtils.ATTR_NAME_ACTION];
      if (action) {
        if (action.action === clientUtils.ACTION_ADD) { // adding
          dbsCreated.push(action.name);
        } else if (action.action === clientUtils.ACTION_REMOVE) {
          dbsDestroyed.push(action.name);
        }
      }

      var policy = data[Doc._policyName];
      if (policy) { // db created?
        policiesUpdated.push(policy);
      }

      var user = data[Doc._userName];
      if (user) { // user created?
        usersUpdated.push(user);
      }

      var roleUser = data[Doc._roleName];
      if (roleUser) { // user added to role?
        roleUsersUpdated.push(roleUser);
      }

    });
  };

  var registerDestroySystemListener = function () {
    db._systemDB().on('doc:destroy', function (doc) {
      var data = doc.get();

      var dbName = data[clientUtils.DB_ATTR_NAME];

      if (dbName && typeof dbName === 'string') { // db destroyed?
        dbsDestroyed.push(dbName);
      }

    });
  };

  var registerSystemListeners = function () {
    registerCreateSystemListener();
    registerUpdateSystemListener();
    registerDestroySystemListener();
  };

  it('should filter system deltas', function () {
    return createDB('myotherdb').then(function () {
      registerSystemListeners();
      return waitUntilDBCreated();
    }).then(function () {
      return policy('priority');
    }).then(function () {
      return createUser('second-user-uuid', 'second-user');
    }).then(function () {
      return updateUser('second-user-uuid', 'second-user');
    }).then(function () {
      return addRole('second-user-uuid', 'second-role');
    }).then(function () {
      return removeRole('second-user-uuid', 'second-role');
    }).then(function () {
      return destroyDB();
    }).then(function () {

      // Make sure we only received the 2nd db
      dbNames.should.eql([]); // filter only allows actions
      dbsCreated.should.eql(['myotherdb']);
      dbsDestroyed.should.eql(['myotherdb']);

      // Make sure we only received the 2nd policy
      policiesCreated[0].should.eql(pol);
      policiesUpdated[0].should.eql(pol);

      // Make sure we only received the 2nd user
      // usersCreated[0].username.should.eql('second-user');
      usersCreated.should.eql([]); // empty as doc is created w/o a name. TODO: could be a race?
      usersUpdated[0].username.should.eql('second-user');

      // Make sure we only receive the 2nd role-users
      roleUsersCreated.length.should.eql(3);
      roleUsersCreated[0].action.should.eql('add'); // originating id-less "add" doc
      roleUsersCreated[0].userUUID.should.eql('second-user-uuid');
      roleUsersCreated[1].action.should.eql('add'); // recorded "add" doc
      roleUsersCreated[1].userUUID.should.eql('second-user-uuid');
      roleUsersCreated[2].action.should.eql('remove'); // originating id-less "remove" doc
      roleUsersCreated[2].userUUID.should.eql('second-user-uuid');

      roleUsersUpdated.length.should.eql(4);
      roleUsersUpdated[0].action.should.eql('add'); // originating id-less "add" doc
      roleUsersUpdated[0].userUUID.should.eql('second-user-uuid');
      roleUsersUpdated[1].action.should.eql('add'); // recorded "add" doc
      roleUsersUpdated[1].userUUID.should.eql('second-user-uuid');
      roleUsersUpdated[2].action.should.eql('remove'); // originating id-less "remove" doc
      roleUsersUpdated[2].userUUID.should.eql('second-user-uuid');
      roleUsersUpdated[3].action.should.eql('remove'); // recorded "remove" doc
      roleUsersUpdated[3].userUUID.should.eql('second-user-uuid');

      return null; // prevent runaway promise errors
    });
  });

});
