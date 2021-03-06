'use strict';

var DeltaDB = require('deltadb/scripts/delta-db'),
  config = require('../../config'),
  commonUtils = require('deltadb-common-utils'),
  Promise = require('bluebird');

describe('auth', function () {

  // A lot of time is needed as we destroy and create the dbs several times. Unfortunately, it
  // appears that mocha doesn't support embedding this in a before() or beforeEach().
  this.timeout(10000);

  var db = null;

  var createUser = function (status) {
    // Connect anonymously first and create the user as Admin Party is in effect
    db = new DeltaDB('mydb', config.url());
    return db.createUser('user-uuid', 'username', 'secret', status).then(function (doc) {
      return commonUtils.once(doc, 'doc:record'); // user created
    }).then(function () {
      return db.destroy(true); // keep remote
    });
  };

  // TODO: it is messy that we have to inspect timestamps in this way to avoid resolving from the
  // createUser instead of the updateUser. Instead, we should probably use "generator" deltas like
  // those used for creating databases
  var resolveOnUpdate = function (ts, doc) {
    return new Promise(function (resolve) {
      doc.on('attr:record', function (attr) {
        if (attr.recorded.getTime() >= ts.getTime()) {
          resolve();
        }
      });
    });
  };

  var updateUser = function (status) {
    // Connect anonymously first and create the user as Admin Party is in effect
    db = new DeltaDB('mydb', config.url());

    var ts = new Date();

    return db.updateUser('user-uuid', 'username', 'secret', status).then(function (doc) {
      return resolveOnUpdate(ts, doc);
    }).then(function () {
      return db.destroy(true); // keep remote
    });
  };

  beforeEach(function () {
    return createUser();
  });

  afterEach(function () {
    return db.destroy();
  });

  it('should sync when authenticated', function () {

    db = new DeltaDB('mydb', config.url(), 'username', 'secret');

    var tasks = db.col('tasks');

    var task1 = tasks.doc({
      thing: 'write'
    });

    task1.save();

    return commonUtils.once(task1, 'attr:record');

  });

  it('should report error when authentication fails', function () {

    db = new DeltaDB('mydb', config.url(), 'username', 'badsecret');

    return commonUtils.once(db, 'error').then(function (args) {
      (args[0].name === 'AuthenticationError').should.eql(true);
    });

  });

  it('should report error when user disabled', function () {

    // Disable user
    return updateUser('disabled').then(function () {

      db = new DeltaDB('mydb', config.url(), 'username', 'secret');

      return commonUtils.once(db, 'error').then(function (args) {
        (args[0].name === 'DisabledError').should.eql(true);
      });

    });

  });

});
