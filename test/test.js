'use strict';

/* global before, after */

// Set config so that our test server doesn't interfere with any production server. We need to set
// the config first so that all of the following code uses this config.
var config = require('../config'),
  testConfig = require('./config');
for (var i in testConfig) {
  config[i] = testConfig[i];
}

var chai = require('chai');
chai.use(require('chai-as-promised'));
chai.should(); // var should = chai.should();

var Partitioner = require('../scripts/partitioner/sql'),
  utils = require('./utils');

describe('deltadb', function () {

  utils.setUp(this);

  before(function () {
    // Create the db and only once for all the tests
    var db = new Partitioner('testdb');
    return db.createDatabase().then(function () {
      return db.closeDatabase(); // close as beforeEach will connect
    });
  });

  after(function () {
    // Destroy the db after all the tests
    var db = new Partitioner('testdb');
    return db.connect().then(function () {
      return db.destroyDatabase();
    });
  });

  require('./spec');

  require('./e2e-no-socket');

  require('./e2e');

});