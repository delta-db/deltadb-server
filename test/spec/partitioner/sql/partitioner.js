'use strict';

var testUtils = require('../../../utils'),
  Partitioner = require('../../../../scripts/partitioner/sql'),
  DBMissingError = require('deltadb-common-utils/scripts/errors/db-missing-error');

describe('partitioner', function () {

  testUtils.setUp(this);

  var part = null;

  beforeEach(function () {
    part = new Partitioner('testdb');
    return part.connect();
  });

  afterEach(function () {
    return part.closeDatabase();
  });

  it('should create and destroy another db', function () {
    return part.createAnotherDatabase('testdb2').then(function () {
      return part.destroyAnotherDatabase('testdb2');
    });
  });

  it('should throw error if trying to connect to missing db', function () {
    var otherPart = new Partitioner('testdb2');
    return testUtils.shouldThrow(function () {
      return otherPart.connect();
    }, new DBMissingError());
  });

  it('should determine if db exists', function () {
    return part.dbExists('testdb2').then(function (exists) {
      exists.should.eql(false);
    });
  });

  it('should create and destroy db with hyphens and underscores', function () {
    return part.createAnotherDatabase('my_test-db-2').then(function () {
      return part.destroyAnotherDatabase('my_test-db-2');
    });
  });

});
