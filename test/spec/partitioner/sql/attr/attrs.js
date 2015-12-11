'use strict';

var partDir = '../../../../../scripts/partitioner/sql',
  partUtils = require('../utils'),
  constants = require(partDir + '/constants'),
  ForbiddenError = require(partDir + '/forbidden-error'),
  Attrs = require(partDir + '/attr/attrs'),
  Promise = require('bluebird');

describe('attrs', function () {

  var args = partUtils.init(this, beforeEach, afterEach, false, before, after);

  var testUtils = args.utils,
    attrRecs = null;

  beforeEach(function () {
    attrRecs = args.db._partitions[constants.LATEST]._attrRecs;
    return args.db._sql.truncateTable(attrRecs._name);
  });

  it('should throw error when destroying', function () {
    var attrs = new Attrs();
    attrs._policy = {
      permitted: function () {
        return Promise.resolve(false);
      }
    };
    return testUtils.shouldThrow(function () {
      return attrs.canDestroy();
    }, new ForbiddenError('cannot destroy attr undefined (docUUID=undefined)'));
  });

});
