'use strict';

/* global before, after */

var partDir = '../../../../../scripts/partitioner/sql',
  partUtils = require('../utils'),
  constants = require(partDir + '/constants'),
  AttrRec = require(partDir + '/attr/attr-rec'),
  System = require(partDir + '/../../system'),
  Promise = require('bluebird');

describe('attr-rec', function () {

  var args = partUtils.init(this, beforeEach, afterEach, false, before, after);

  var userUtils = null,
    attrRecs = null,
    testUtils = args.utils;

  beforeEach(function () {
    userUtils = args.userUtils;
    attrRecs = args.db._partitions[constants.LATEST]._attrRecs;
    return args.db._sql.truncateTable(attrRecs._name);
  });

  it('should find doc', function () {
    args.db.createAnotherDatabase = function () { // mock creation so DB not actually created
      return Promise.resolve();
    };

    var params = {
      docId: 1,
      name: System.DB_ATTR_NAME,
      value: {
        action: 'add',
        name: 'mydb'
      }
    };
    var attrRec = new AttrRec(args.db._sql, constants.LATEST, params, args.db);
    return attrRec.create().then(function () {
      return attrRecs.findDoc(System.DB_ATTR_NAME, 'mydb');
    }).then(function (docId) {
      docId.should.eql(1);
    });
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
    return testUtils.shouldThrow(function () {
      return attrRec.replace();
    }, new Error('err'));
  });

});
