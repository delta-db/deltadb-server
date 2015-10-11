'use strict';

/* global before, after */

var chai = require('chai');
chai.use(require('chai-as-promised'));
chai.should(); // var should = chai.should();

var Partitioner = require('../scripts/partitioner/sql'),
  utils = require('./utils'),
  DBMissingError = require('../scripts/client/db-missing-error');

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

});
