'use strict';

/* global before, after */

var partUtils = require('../utils'),
  constants = require('../../../../../scripts/partitioner/sql/constants'),
  QueueAttrRecs = require('../../../../../scripts/partitioner/sql/queue/queue-attr-recs'),
  testUtils = require('../../../../utils');

describe('multiple', function () {

  var args = partUtils.init(this, beforeEach, afterEach, null, before, after);

  var queueAndProcess = function (changes) {
    // Force quorum=true. We will test the processing of quorum elsewhere
    return testUtils.queueAndProcess(args.db, changes, true);
  };

  var changes = [{
      col: 'task',
      id: '1',
      name: 'thing',
      val: '"write"',
      up: '2014-01-01T10:00:00.000Z'
    }, {
      col: 'task',
      id: '1',
      name: 'priority',
      val: '"medium"',
      up: '2014-01-01T10:00:00.000Z'
    }, {
      col: 'task',
      id: '1',
      name: 'priority',
      val: '"high"',
      up: '2014-01-01T10:01:00.000Z'
    },

    {
      col: 'task',
      id: '2',
      name: 'thing',
      val: '"sing"',
      up: '2014-01-01T10:01:00.000Z'
    }, {
      col: 'task',
      id: '2',
      up: '2014-01-01T10:02:00.000Z'
    }, // del doc

    {
      col: 'task',
      id: '3',
      name: 'thing',
      val: '"play"',
      up: '2014-01-01T10:02:00.000Z'
    }, {
      col: 'task',
      id: '3',
      name: 'priority',
      val: '"medium"',
      up: '2014-01-01T10:02:00.000Z'
    }, {
      col: 'task',
      id: '3',
      name: 'priority',
      up: '2014-01-01T10:03:00.000Z'
    }
  ]; // del attr

  var docsShouldEqual = function (partition) {
    // TODO: ensure rows[0].recorded_at is from the last couple seconds
    return testUtils.docsShouldEql(args.db, partition, [{
      id: testUtils.docId,
      uuid: '1',
      updated_at: changes[2].up
    }, {
      id: testUtils.docId + 1,
      uuid: '2',
      updated_at: changes[3].up,
      destroyed_at: changes[4].up
    }, {
      id: testUtils.docId + 2,
      uuid: '3',
      updated_at: changes[7].up
    }]);
  };

  var shouldAddToAllOrRecent = function (partition) {
    return queueAndProcess(changes).then(function () {
      return docsShouldEqual(partition);
    }).then(function () {
      return testUtils.attrsShouldEql(args.db, partition, [{
          doc_id: testUtils.docId,
          name: 'priority',
          value: '"medium"',
          updated_at: changes[1].up
        }, {
          doc_id: testUtils.docId,
          name: 'priority',
          value: '"high"',
          updated_at: changes[2].up
        }, {
          doc_id: testUtils.docId,
          name: 'thing',
          value: '"write"',
          updated_at: changes[0].up
        },

        {
          doc_id: testUtils.docId + 1,
          name: 'thing',
          value: '"sing"',
          updated_at: changes[3].up
        }, {
          doc_id: testUtils.docId + 1,
          name: null,
          value: null,
          updated_at: changes[4].up
        },

        {
          doc_id: testUtils.docId + 2,
          name: 'priority',
          value: '"medium"',
          updated_at: changes[6].up
        }, {
          doc_id: testUtils.docId + 2,
          name: 'priority',
          value: null,
          updated_at: changes[7].up
        }, {
          doc_id: testUtils.docId + 2,
          name: 'thing',
          value: '"play"',
          updated_at: changes[5].up
        }
      ], true);
    });
  };

  it('should add to all', function () {
    return shouldAddToAllOrRecent(constants.ALL);
  });

  it('should add to recent', function () {
    return shouldAddToAllOrRecent(constants.RECENT);
  });

  it('should replace latest', function () {
    return shouldAddToAllOrRecent(constants.ALL).then(function () {
      return docsShouldEqual(constants.LATEST);
    }).then(function () {
      return testUtils.attrsShouldEql(args.db, constants.LATEST, [{
          doc_id: testUtils.docId,
          name: 'priority',
          value: '"high"',
          updated_at: changes[2].up
        }, {
          doc_id: testUtils.docId,
          name: 'thing',
          value: '"write"',
          updated_at: changes[0].up
        },

        {
          doc_id: testUtils.docId + 1,
          name: 'thing',
          value: '"sing"',
          updated_at: changes[3].up
        }, {
          doc_id: testUtils.docId + 1,
          name: null,
          value: null,
          updated_at: changes[4].up
        },

        {
          doc_id: testUtils.docId + 2,
          name: 'priority',
          value: null,
          updated_at: changes[7].up
        }, {
          doc_id: testUtils.docId + 2,
          name: 'thing',
          value: '"play"',
          updated_at: changes[5].up
        }
      ], true);
    });
  });

  it('should destroy from queue', function () {
    return queueAndProcess(changes).then(function () {
      return args.db._sql.find(null, QueueAttrRecs.NAME);
    }).then(function (results) {
      (results.rows === null).should.eql(true);
    });
  });

  it('should only update if latest', function () {
    var changes = [{
      col: 'task',
      id: '1',
      name: 'thing',
      val: '"write"',
      up: '2014-01-01T10:00:00.000Z'
    }, {
      col: 'task',
      id: '1',
      name: 'priority',
      val: '"medium"',
      up: '2014-01-01T10:02:00.000Z'
    }, {
      col: 'task',
      id: '1',
      name: 'priority',
      val: '"high"',
      up: '2014-01-01T10:01:00.000Z'
    }];

    return queueAndProcess(changes).then(function () {
      return testUtils.findAttrs(args.db, constants.LATEST);
    }).then(function () {
      return testUtils.attrsShouldEql(args.db, constants.LATEST, [{
        name: 'priority',
        value: '"medium"',
        updated_at: changes[1].up
      }, {
        name: 'thing',
        value: '"write"',
        updated_at: changes[0].up
      }], true);
    });
  });

});
