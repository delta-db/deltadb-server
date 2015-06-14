'use strict';

/* global before, after */

var partDir = '../../../../../scripts/partitioner/sql',
  partUtils = require('../utils'),
  constants = require(partDir + '/constants');

describe('attr-recs', function () {

  var args = partUtils.init(this, beforeEach, afterEach, false, before, after);

  var attrRecs = null;

  beforeEach(function () {
    attrRecs = args.db._partitions[constants.LATEST]._attrRecs;
    return args.db._sql.truncateTable(attrRecs._name);
  });

  it('should get doc', function () {
    return attrRecs.getDoc(1, new Date());
  });

  it('should find doc', function () {
    return attrRecs.findDoc('thing', '"sing"');
  });

});