'use strict';

/* global before, after */

var partDir = '../../../../../scripts/partitioner/sql',
  partUtils = require('../utils'),
  constants = require(partDir + '/constants'),
  Attr = require(partDir + '/attr/attr'),
  System = require(partDir + '/../../system'),
  Promise = require('bluebird'),
  utils = require(partDir + '/../../utils'),
  ForbiddenError = require(partDir + '/forbidden-error');

describe('docs', function () {

  var noAll = true; // don't set default policy so that the policy doesn't muddy our tests
  var args = partUtils.init(this, beforeEach, afterEach, noAll, before, after);
  var testUtils = args.utils;

  var origDocId = null,
    uuidOrig = null;
  beforeEach(function () {
    origDocId = testUtils.docId;
    uuidOrig = utils.uuid;
    return args.db._partitions[constants.ALL]._docs.truncateTable();
  });

  afterEach(function () {
    // restore as modified below
    testUtils.docId = origDocId;
    utils.uuid = uuidOrig;
  });

  it('should take doc inventory', function () {
    var up = new Date();
    var delta = {
      doc_uuid: '1',
      col_name: 'task',
      attr_name: 'priority',
      attr_val: '"high"',
      user_uuid: 'user-uuid',
      updated_at: up,
      recorded_at: up
    };
    args.db._process._takeDocInventoryForAttr(delta);
    args.db._process._docIds[constants.ALL].should.eql({
      '1': {
        docUUID: '1',
        userUUID: 'user-uuid',
        colName: 'task',
        recordedAt: up,
        updatedAt: up,
        attrName: 'priority',
        attrVal: '"high"',
        recordedByUserId: null
      }
    });
  });

  it('should ignore cached docs when taking inventory', function () {
    var up = new Date();
    var delta = {
      doc_uuid: '1',
      col_name: 'task',
      attr_name: 'priority',
      attr_val: '"low"',
      user_uuid: 'user-uuid',
      updated_at: up,
      recorded_at: up
    };
    args.db._process._docIds[constants.ALL]['1'] = null; // mock previous lookup
    args.db._process._takeDocInventoryForAttr(delta);
    args.db._process._docIds[constants.ALL].should.eql({
      '1': null
    });
  });

  it('should create doc', function () {
    var up = new Date();
    args.db._process._userIds['user-uuid'] = 1; // mock creation of user
    args.db._process._colIds['task'] = 1; // mock creation of col
    args.db._process._docIds[constants.ALL] = {
      '1': {
        docUUID: '1',
        userUUID: 'user-uuid',
        colName: 'task',
        recordedAt: up,
        updatedAt: up,
        attrName: 'priority',
        attrVal: '"high"'
      }
    };
    return args.db._process._lookupOrCreateDocs().then(function () {
      testUtils.docId = 0; // find all docs
      return testUtils.findDocs(args.db, constants.ALL);
    }).then(function (results) {
      testUtils.contains([{
        uuid: '1'
      }], results.rows);
    });
  });

  it('should gen doc uuid when adding', function () {
    utils.uuid = function () { // mock
      return 'doc-uuid';
    };

    args.db._process._partitions[constants.LATEST]._docs.findUUID = function () { // mock
      return Promise.resolve('doc-uuid');
    };

    var attrValStr = JSON.stringify({
      action: Attr.ACTION_ADD,
      name: 'my-db'
    });
    var attr = {
      attr_name: System.DB_ATTR_NAME,
      attr_val: attrValStr
    };
    return args.db._process._getOrGenDocUUID(attr).then(function () {
      attr.doc_uuid.should.eql('doc-uuid');
    });
  });

  it('should get doc uuid when removing', function () {
    args.db._process._partitions[constants.LATEST]._docs.findUUID = function () { // mock
      return Promise.resolve('doc-uuid');
    };

    var attrValStr = JSON.stringify({
      action: Attr.ACTION_REMOVE,
      name: 'my-db'
    });
    var attr = {
      attr_name: System.DB_ATTR_NAME,
      attr_val: attrValStr
    };
    return args.db._process._getOrGenDocUUID(attr).then(function () {
      attr.doc_uuid.should.eql('doc-uuid');
    });
  });

  it('should throw non-forbidden error', function () {
    args.db._process._partitions[constants.ALL]._docs.getId = function () {
      return new Promise(function () {
        throw new Error('err');
      });
    };
    args.db._process._userIds = {
      'user-uuid': 1
    };
    args.db._process._colIds = {
      'col-name': 1
    };
    return testUtils.shouldThrow(function () {
      return args.db._process._getOrCreateDoc(constants.ALL, {
        colName: 'col-name',
        userUUID: 'user-uuid'
      });
    }, new Error('err'));
  });

  it('should throw forbidden error', function () {
    args.db._process._partitions[constants.ALL]._docs.getId = function () {
      return new Promise(function () {
        throw new ForbiddenError('err');
      });
    };
    args.db._process._userIds = {
      'user-uuid': 1
    };
    args.db._process._colIds = {
      'col-name': 1
    };
    return args.db._process._getOrCreateDoc(constants.ALL, {
      colName: 'col-name',
      userUUID: 'user-uuid'
    });
  });

  it('should create user role docs', function () {
    var colId = 1,
      userId = 1;
    return args.db._process._canCreateUserRoleDocs(colId, colId, 'user-doc-uuid',
      'role-doc-uuid',
      userId, userId);
  });

  it('should ignore cached docs', function () {
    args.db._process._docIds[constants.LATEST]['doc-uuid'] = 1;
    return args.db._process._cacheDoc({
      docUUID: 'doc-uuid'
    });
  });

});
