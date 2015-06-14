'use strict';

/* global before, after */

var partUtils = require('../utils'),
  Changes = require('../../../../../scripts/partitioner/sql/changes');

describe('offset', function () {

  var args = partUtils.init(this, beforeEach, afterEach, null, before, after);
  var testUtils = args.utils;

  var queueAndProcess = function (changes) {
    // Force quorum=true. We don't need to consider quorum when getting changes as only changes
    // recorded by quorum are added to LATEST and server downloads all changes regardless of quorum
    // status.
    return testUtils.queueAndProcess(args.db, changes, true);
  };

  it('should get changes by offset', function () {
    var changes = null,
      changes1 = [],
      changes2 = [],
      changes3 = [],
      up = (new Date()).toISOString();

    for (var i = 1; i <= 11; i++) {
      if (i > 10) {
        changes = changes3;
      } else if (i > 5) {
        changes = changes2;
      } else {
        changes = changes1;
      }
      changes.push({
        col: 'task',
        id: i + '',
        name: 'prority',
        val: '"low"',
        up: up
      });
    }

    return queueAndProcess(changes1).then(function () {
      return testUtils.timeout(10); // sleep to guarantee order of changes
    }).then(function () {
      return queueAndProcess(changes2);
    }).then(function () {
      return testUtils.timeout(10); // sleep to guarantee order of changes
    }).then(function () {
      return args.db.changes(null, null, 5, 0);
    }).then(function (changes) {
      changes1.push('more'); // indicates more pages
      testUtils.changesShouldEql(changes1, changes);
    }).then(function () {
      return queueAndProcess(changes3); // simulate change between reads
    }).then(function () {
      return args.db.changes(null, null, 5, 5);
    }).then(function (changes) {
      changes2.push('more'); // indicates more pages
      testUtils.changesShouldEql(changes2, changes);
    }).then(function () {
      return args.db.changes(null, null, 5, 10);
    }).then(function (changes) {
      testUtils.changesShouldEql(changes3, changes);
    });
  });

  it('should throw error if limit too large', function () {
    return testUtils.shouldThrow(function () {
      return args.db.changes(null, null, Changes._MAX_LIMIT + 1);
    }, new Error('limit (' + (Changes._MAX_LIMIT + 1) + ') cannot be greater than ' +
      Changes._MAX_LIMIT));
  });

});