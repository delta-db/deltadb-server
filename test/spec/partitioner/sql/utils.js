'use strict';

var Partitioner = require('../../../../scripts/partitioner/sql'),
  utils = require('../../../utils'),
  UserUtils = require('../../../user-utils');

var Utils = function () {};

Utils.prototype.init = function (thisArg, beforeEach, afterEach, noAll /* , before, after */ ) {

  // Instead of creating and destroying DB for each test, it is much faster to just truncate the
  // tables after each test

  utils.setUp(thisArg);

  var args = {};
  args.userUtils = new UserUtils(args);

  beforeEach(function () {
    // Faster to truncate than destroy & create - only create/destroy once for each set of tests
    args.db = new Partitioner('testdb');
    return args.db.connect().then(function () {
      if (!noAll) {
        return args.userUtils.allowAll(); // default to everyone having full access
      }
    });
  });

  afterEach(function () {
    // To be sure that a test didn't mock a piece of the partitioner that would affect the
    // truncation, we'll close the db and re-connect
    return args.db.closeDatabase().then(function () {
      args.db = new Partitioner('testdb');
      return args.db.connect();
    }).then(function () {
      return args.db.truncateDatabase();
    }).then(function () {
      return args.db.closeDatabase();
    });
  });

  return args;
};

module.exports = new Utils();
