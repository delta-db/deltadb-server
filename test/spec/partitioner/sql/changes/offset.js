'use strict';

var partUtils = require('../utils'),
  Changes = require('../../../../../scripts/partitioner/sql/changes'),
  testUtils = require('../../../../utils'),
  commonTestUtils = require('deltadb-common-utils/scripts/test-utils');

describe('offset', function () {

  var args = partUtils.init(this, beforeEach, afterEach, null, before, after);

  // Note: to reliably ensure that changes are stored in a particular order, we need to
  // queueAndProcess() and then sleep after adding each change
  var queueAndProcessEach = function (changes) {
    // Force quorum=true. We don't need to consider quorum when getting changes as only changes
    // recorded by quorum are added to LATEST and server downloads all changes regardless of quorum
    // status.
    return testUtils.queueAndProcessEach(args.db, changes, true);
  };

  it('should get changes by offset', function () {
    var changes = [],
      readChanges = [],
      up = (new Date()).toISOString(),
      n = 11;

    for (var i = 1; i <= n; i++) {
      changes.push({
        col: 'task',
        id: i + '',
        name: 'prority',
        val: '"low ' + i + '"',
        up: up
      });
    }

    var writeAndReadAllChanges = function () {
      return queueAndProcessEach(changes).then(function () {
        return args.db.changes();
      }).then(function (_readChanges) {
        readChanges = _readChanges;
        readChanges.length.should.eql(changes.length);
      });
    };

    var readAndCheckPage = function (offset) {
      return args.db.changes(null, null, 5, offset).then(function (changes) {
        var expPageChanges = readChanges.slice(offset, Math.min(offset + 5, n));
        if (offset + 5 < n) {
          expPageChanges.push('more'); // indicates more pages
        }
        expPageChanges.should.eql(changes);
      });
    };

    var readAndCheckPages = function () {
      return readAndCheckPage(0).then(function () {
        return readAndCheckPage(5);
      }).then(function () {
        return readAndCheckPage(10);
      });
    };

    return writeAndReadAllChanges().then(function () {
      return readAndCheckPages();
    });

  });

  it('should throw error if limit too large', function () {
    return commonTestUtils.shouldThrow(function () {
      return args.db.changes(null, null, Changes._MAX_LIMIT + 1);
    }, new Error('limit (' + (Changes._MAX_LIMIT + 1) + ') cannot be greater than ' +
      Changes._MAX_LIMIT));
  });

});
