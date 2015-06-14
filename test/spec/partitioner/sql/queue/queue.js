'use strict';

/* global before, after */

var partUtils = require('../utils'),
  QueueAttrRecs = require('../../../../../scripts/partitioner/sql/queue/queue-attr-recs');

describe('queue', function () {

  var args = partUtils.init(this, beforeEach, afterEach, true, before, after);
  var utils = args.utils;

  var queueAttrs = function () {
    return args.db._sql.find(null, QueueAttrRecs.NAME, null, null, [
        ['col_name', 'asc'],
        ['attr_name', 'asc']
      ])
      .then(function (results) {
        return results.rows ? results.rows : null;
      });
  };

  var queueAttrsShouldEql = function (changes, quorum, superUUID) {
    var attrs = [];
    changes.forEach(function (change) {
      attrs.push({
        col_name: change.col,
        doc_uuid: change.id,
        attr_name: change.name,
        attr_val: change.val,
        user_uuid: change.uid ? change.uid : null,
        updated_at: new Date(change.up),
        seq: change.seq ? change.seq : 0,
        quorum: quorum ? quorum : null,
        super_uuid: superUUID ? superUUID : null
      });
    });
    return queueAttrs().then(function (rows) {
      utils.contains(attrs, rows);
    });
  };

  var changes = [{
    col: 'tag',
    id: '2',
    name: 'name',
    val: '"personal"',
    up: '2014-01-01T10:00:00.000Z',
    uid: 'user-uuid2',
    seq: -1
  }, {
    col: 'task',
    id: '1',
    name: 'priority',
    val: '"high"',
    up: '2014-01-01T10:00:00.000Z',
    uid: 'user-uuid1',
    seq: 1
  }, {
    col: 'task',
    id: '1',
    name: 'thing',
    val: '"write"',
    up: '2014-01-01T10:00:00.000Z',
    uid: 'user-uuid1'
  }, {
    col: 'task',
    id: '1',
    name: 'thing',
    val: '"play"',
    up: '2014-01-01T10:00:00.100Z'
  }];

  it('should queue', function () {
    return args.db.queue(changes).then(function () {
      return queueAttrsShouldEql(changes);
    });
  });

  it('should queue with quorum', function () {
    return args.db.queue(changes, true).then(function () {
      return queueAttrsShouldEql(changes, true);
    });
  });

  it('should queue from super', function () {
    var superUUID = 'super-uuid';
    return args.db.queue(changes, null, superUUID).then(function () {
      return queueAttrsShouldEql(changes, null, superUUID);
    });
  });

  // Note: server needs to automatically set quorum when queue() is called when there is only 1
  // server

});