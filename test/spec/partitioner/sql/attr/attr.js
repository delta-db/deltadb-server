'use strict';

/* global before, after */

var partDir = '../../../../../scripts/partitioner/sql',
  partUtils = require('../utils'),
  constants = require(partDir + '/constants'),
  ForbiddenError = require(partDir + '/forbidden-error'),
  Attr = require(partDir + '/attr/attr'),
  Promise = require('bluebird');

describe('attr', function () {

  var args = partUtils.init(this, beforeEach, afterEach, false, before, after);

  var testUtils = args.utils,
    attrRecs = null;

  beforeEach(function () {
    attrRecs = args.db._partitions[constants.LATEST]._attrRecs;
    return args.db._sql.truncateTable(attrRecs._name);
  });

  it('should construct without params', function () {
    new Attr();
  });

  it('should set destroyed or update doc', function () {
    var attr = new Attr();
    attr.destroyingDoc = function () {
      return false;
    };
    attr._partitionName = constants.ALL;
    attr._partitions = {};
    attr._partitions[constants.ALL] = {
      _docs: {
        update: function () {
          return Promise.resolve();
        }
      }
    };
    attr.setDestroyedOrUpdateDoc();
  });

  it('should throw non-forbidden error when creating', function () {
    var attr = new Attr();
    attr.create = function () {
      return new Promise(function () {
        throw new Error('err');
      });
    };
    return testUtils.shouldThrow(function () {
      return attr.createLatestAndAllAndRecentAndRecentAttr();
    }, new Error('err'));
  });

  it('should handle forbidden error when creating', function () {
    var attr = new Attr();
    attr.create = function () {
      return new Promise(function () {
        throw new ForbiddenError('err');
      });
    };
    return attr.createLatestAndAllAndRecentAndRecentAttr();
  });

});