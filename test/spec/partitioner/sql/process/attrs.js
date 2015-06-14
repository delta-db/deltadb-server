'use strict';

/* global before, after */

var partDir = '../../../../../scripts/partitioner/sql',
  partUtils = require('../utils'),
  constants = require(partDir + '/constants'),
  Promise = require('bluebird');

describe('attrs', function () {

  var args = partUtils.init(this, beforeEach, afterEach, null, before, after);
  var testUtils = args.utils;

  it('should create or update attr', function () {
    return args.db._process._createOrUpdateAttr(constants.ALL, {
      user_uuid: 1
    });
  });

  it('should throw non-forbidden error', function () {
    args.db._process._createOrUpdateAttrs = function () {
      return new Promise(function () {
        throw new Error('err');
      });
    };
    return testUtils.shouldThrow(function () {
      return args.db._process._processAttr();
    }, new Error('err'));
  });

});