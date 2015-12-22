'use strict';

var DeltaDB = require('deltadb/scripts/delta-db'),
  config = require('../../config'),
  commonUtils = require('deltadb-common-utils');

describe('auth-filter', function () {

  // A lot of time is needed as we destroy and create the dbs several times. Unfortunately, it
  // appears that mocha doesn't support embedding this in a before() or beforeEach().
  this.timeout(10000);

  var db = null,
    uuid = null;

  var createUser = function (userUUID, username, password) {
    return db.createUser(userUUID, username, password).then(function (doc) {
      return commonUtils.once(doc, 'doc:record'); // user created
    });
  };

  var createUsers = function () {
    // Connect anonymously first and create the users as Admin Party is in effect
    db = new DeltaDB('mydb', config.url());
    return createUser('user-uuid-1', 'username1', 'secret').then(function () {
      return createUser('user-uuid-2', 'username2', 'secret');
    }).then(function () {
      return db.destroy(true); // keep remote
    });
  };

  beforeEach(function () {
    return createUsers();
  });

  afterEach(function () {
    return db.destroy();
  });

  var setPolicy = function () {

    // We use an attr policy as we already have a default policy defined for our col
    var pol = {
      col: {
        create: '$all',
        read: '$all',
        update: '$all',
        destroy: '$all'
      },
      attrs: {
        private: {
          create: '$owner',
          read: '$owner',
          update: '$owner',
          destroy: '$owner'
        }
      }
    };

    return db.policy('tasks', pol).then(function (doc) {
      return commonUtils.once(doc, 'doc:record');
    });
  };

  // Authenticate with 1st user and create the doc
  var setPolicyAndCreateDoc = function () {

    db = new DeltaDB('mydb', config.url(), 'username1', 'secret');

    // Set policy so that only owner can access "private" attr
    return setPolicy().then(function () {
      // Create a doc
      var tasks = db.col('tasks');
      var task = tasks.doc({
        thing: 'write',
        private: 'something private'
      });
      uuid = task.id();
      task.save();
      return commonUtils.once(task, 'doc:record'); // wait for doc to be recorded
    }).then(function () {
      return db.destroy(true); // keep remote
    });

  };

  // Authenticate with the 2nd user and make sure the "private" attr isn't received
  var privateShouldNotBeReceived = function () {
    db = new DeltaDB('mydb', config.url(), 'username2', 'secret');

    var tasks = db.col('tasks');
    var task = tasks.doc({
      $id: uuid
    });

    var received = [];

    task.on('attr:record', function (attr) {
      received.push(attr.name);
    });

    // Wait a little bit and make sure that we only received the change for the attr to which we
    // have access. 2 secs is not enough time to guarantee we receive any changes on TravisCI.
    return commonUtils.timeout(4000).then(function () {
      received.should.eql(['thing']);
      return null; // prevent runaway promise warnings
    });
  };

  it('should filter deltas', function () {
    return setPolicyAndCreateDoc().then(function () {
      return privateShouldNotBeReceived();
    });
  });

});
