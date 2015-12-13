'use strict';

/* global before, after */

var partDir = '../../../../../scripts/partitioner/sql',
  partUtils = require('../utils'),
  constants = require(partDir + '/constants'),
  Promise = require('bluebird'),
  commonUtils = require('deltadb-common-utils'),
  SQLError = require('deltadb-orm-sql/scripts/common/sql-error'),
  commonTestUtils = require('deltadb-common-utils/scripts/test-utils');

describe('doc-recs', function () {

  var args = partUtils.init(this, beforeEach, afterEach, false, before, after);

  var docs = null;

  beforeEach(function () {
    docs = args.db._partitions[constants.LATEST]._docs;
  });

  it('should get user role doc uuid', function () {
    var colId = 1,
      userId = 1,
      destroyedAt = null,
      recordedAt = null,
      updatedAt = new Date(),
      roleId = 1,
      docId = null;
    return docs.create('doc-uuid', colId, userId, destroyedAt, recordedAt, updatedAt)
      .then(function (_docId) {
        docId = _docId;
        return docs.get('doc-uuid');
      }).then(function () {
        args.db._userRoles.getDocId = function () { // Mock UserRoles
          return Promise.resolve(docId);
        };
        return docs.getUserRoleDocUUID(userId, roleId);
      }).then(function (docUUID) {
        docUUID.should.eql('doc-uuid');
      });
  });

  it('should should get missing uuid', function () {
    return docs.getUUID(-1);
  });

  it('should get or create when exists', function () {
    docs.get = function () {
      return Promise.resolve(1);
    };
    return docs.getOrCreate();
  });

  it('should throw non-sql error when getting or creating', function () {
    docs.get = function () {
      return Promise.resolve(null);
    };
    docs.create = function () {
      return new Promise(function () {
        throw new Error('err');
      });
    };
    commonTestUtils.shouldThrow(function () {
      return docs.getOrCreate();
    }, new Error('err'));
  });

  it('should ignore sql error when getting or creating', function () {
    docs.get = function () {
      return Promise.resolve(null);
    };
    docs.create = function () {
      return new Promise(function () {
        throw new SQLError('err');
      });
    };
    return docs.getOrCreate();
  });

  it('should get last destroyed if missing', function () {
    return docs.lastDestroyedAt(-1);
  });

  it('should find uuid', function () {
    docs._attrRecs.findDoc = function () {
      return Promise.resolve(1);
    };

    docs.getUUID = function (docId) { // mock
      return Promise.resolve('uuid' + docId);
    };

    return docs.findUUID('attr-name', 'attr-val').then(function (uuid) {
      uuid.should.eql('uuid1');
    });
  });

  it('should find uuid when missing', function () {
    docs._attrRecs.findDoc = function () {
      return Promise.resolve(null);
    };

    return docs.findUUID('attr-name', 'attr-val').then(function (uuid) {
      commonUtils.notDefined(uuid).should.eql(true);
    });
  });

});
