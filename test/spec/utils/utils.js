'use strict';

var utils = require('../../../scripts/utils'),
  testUtils = require('../../utils'),
  bcrypt = require('bcrypt');

describe('utils', function () {

  var genSalt = bcrypt.genSalt,
    hash = bcrypt.hash;

  afterEach(function () {
    // Restore fakes
    utils._bcrypt.genSalt = genSalt;
    utils._bcrypt.hash = hash;
  });

  it('should check for empty obj', function () {
    utils.empty({
      attr: 'stuff'
    }).should.eql(false);
  });

  it('should resolve factory', function () {
    var promise = utils.resolveFactory();
    return promise().then(function () {
      // empty case
    });
  });

  it('should merge null objs', function () {
    var merged = utils.merge(null, null);
    merged.should.eql({});
  });

  it('should reject salt and hash when salt err', function () {
    utils._bcrypt.genSalt = function (rounds, cb) {
      cb(new Error('error'));
    };

    return testUtils.shouldThrow(function () {
      return utils.genSaltAndHashPassword('secret');
    }, new Error('error'));
  });

  it('should reject salt and hash when hash err', function () {
    utils._bcrypt.hash = function (password, salt, cb) {
      cb(new Error('error'));
    };

    return testUtils.shouldThrow(function () {
      return utils.genSaltAndHashPassword('secret');
    }, new Error('error'));
  });

});