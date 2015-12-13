'use strict';

/* global before, after */

var partDir = '../../../../../scripts/partitioner/sql',
  partUtils = require('../utils'),
  constants = require(partDir + '/constants'),
  ForbiddenError = require(partDir + '/forbidden-error'),
  Attrs = require(partDir + '/attr/attrs'),
  Promise = require('bluebird'),
  commonTestUtils = require('deltadb-common-utils/scripts/test-utils');

describe('attrs', function () {

  var args = partUtils.init(this, beforeEach, afterEach, false, before, after);

  var attrRecs = null;

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
    return commonTestUtils.shouldThrow(function () {
      return attrs.canDestroy();
    }, new ForbiddenError('cannot destroy attr undefined (docUUID=undefined)'));
  });

});
