'use strict';

/* global before, after */

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
    return db.connectAndCreate().then(function () {
      return db.closeDatabase(); // close as beforeEach will connect
    }).catch(function () {
      // If there is an error, assume it is because the testdb already exists so just close db as
      // the tests will truncate the db before each test
      return db.closeDatabase();
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

  require('./e2e');

});