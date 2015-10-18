'use strict';

/* global before, after */

var partUtils = require('../utils'),
  constants = require('../../../../../scripts/partitioner/sql/constants');

describe('archive', function () {

  var args = partUtils.init(this, beforeEach, afterEach, null, before, after);
  var utils = args.utils;

  var shouldArchive = function (partition, quorum) {
    var updated = null;

    var createChanges = [{
      col: 'task',
      id: '1',
      name: 'thing',
      val: '"write a song"',
      up: '2014-01-01T10:01:00.000Z'
    }, {
      col: 'task',
      id: '1',
      name: 'priority',
      val: '"medium"',
      up: '2014-01-01T10:01:00.000Z'
    }];

    var updateChanges = [{
      col: 'task',
      id: '1',
      name: 'priority',
      val: '"high"',
      up: '2014-01-01T10:02:00.000Z'
    }];

    return utils.queueAndProcess(args.db, createChanges, quorum).then(function () {
      return utils.sleep(); // ensure different timestamp
    }).then(function () {
      updated = new Date();
      return utils.queueAndProcess(args.db, updateChanges, quorum);
    }).then(function () {
      return args.db.archive(updated); // archive everything before last change
    }).then(function () {
      return args.db._globals.get('archived');
    }).then(function (archived) {
      archived.should.eql('' + updated.getTime());
    }).then(function () {
      return utils.findDocs(args.db, partition);
    }).then(function (results) {
      var rows = results.rows;
      if (!quorum && partition === constants.LATEST) {
        (rows === null).should.eql(true);
      } else {
        utils.docsEql([{
          uuid: '1'
        }], rows);
      }
    }).then(function () {
      return utils.findAttrs(args.db, partition);
    }).then(function (results) {
      var rows = results.rows;
      if (!quorum && partition === constants.LATEST) {
        (rows === null).should.eql(true);
      } else {
        utils.attrsEql([{
          name: 'priority',
          value: '"high"',
          quorum: quorum
        }], rows);
      }
    }).then(function () {
      updated = new Date();
      return args.db.archive(updated);
    }).then(function () {
      return args.db._sql.find(null, partition + 'docs');
    }).then(function (results) {
      (results.rows === null).should.eql(true);
    }).then(function () {
      return args.db._sql.find(null, partition + 'attrs');
    }).then(function (results) {
      (results.rows === null).should.eql(true);
    }).then(function () {
      return args.db._globals.get('archived');
    }).then(function (archived) {
      archived.should.eql('' + updated.getTime());
    });
  };

  it('should archive recent', function () {
    return shouldArchive(constants.RECENT, null);
  });

  it('should archive recent and carry over quorum', function () {
    return shouldArchive(constants.RECENT, true);
  });

});
