'use strict';

var DeltaDB = require('../../scripts/client/delta-db'),
  config = require('../../config'),
  clientUtils = require('../../scripts/client/utils');

describe('auth', function () {

  // A lot of time is needed as we destroy and create the dbs several times. Unfortunately, it
  // appears that mocha doesn't support embedding this in a before() or beforeEach().
  this.timeout(10000);

  var db = null;

  var createUser = function () {
    // Connect anonymously first and create the user as Admin Party is in effect
    db = new DeltaDB('mydb', config.URL);
    return db.createUser('user-uuid', 'username', 'secret').then(function (doc) {
      return clientUtils.once(doc, 'doc:record'); // user created
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

    db = new DeltaDB('mydb', config.URL, 'username', 'secret');

    var tasks = db.col('tasks');

    var task1 = tasks.doc({
      thing: 'write'
    });

    task1.save();

    return clientUtils.once(task1, 'attr:record');

  });

});
