'use strict';

/* global before, after */

var partDir = '../../../../../scripts/partitioner/sql',
  partUtils = require('../utils'),
  constants = require(partDir + '/constants'),
  AttrRec = require(partDir + '/attr/attr-rec'),
  Promise = require('bluebird'),
  commonTestUtils = require('deltadb-common-utils/scripts/test-utils');

describe('attr-rec', function () {

  var args = partUtils.init(this, beforeEach, afterEach, false, before, after);

  var userUtils = null,
    attrRecs = null;

  beforeEach(function () {
    userUtils = args.userUtils;
    attrRecs = args.db._partitions[constants.LATEST]._attrRecs;
    return args.db._sql.truncateTable(attrRecs._name);
  });

  it('should get id', function () {
    var params = {
      docId: 1,
      seq: 0
    };
    var attrRec = new AttrRec(args.db._sql, constants.ALL, params, args.db);
    return attrRec.getId();
  });

  it('should throw non-sql error when replacing', function () {
    var params = {
      docId: 1,
      seq: 0,
      updatedAt: new Date()
    };
    var attrRec = new AttrRec(args.db._sql, constants.ALL, params, args.db);
    attrRec.create = function () {
      return new Promise(function () {
        throw new Error('err');
      });
    };
    return commonTestUtils.shouldThrow(function () {
      return attrRec.replace();
    }, new Error('err'));
  });

});
