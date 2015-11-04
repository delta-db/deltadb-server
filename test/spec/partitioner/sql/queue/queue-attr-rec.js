'use strict';

/* global before, after */

var QueueAttrRecs = require('../../../../../scripts/partitioner/sql/queue/queue-attr-recs'),
  QueueAttrRec = require('../../../../../scripts/partitioner/sql/queue/queue-attr-rec'),
  utils = require('../../../../utils'),
  partUtils = require('../utils');

describe('queue-attr-rec', function () {

  var args = partUtils.init(this, beforeEach, afterEach, true, before, after);

  var sql = null,
    recs = null;

  beforeEach(function () {
    sql = args.db._sql;
    recs = args.db._queueAttrRecs;
  });

  it('should create', function () {
    var rec = new QueueAttrRec(sql, null, 'col', 'doc-uuid', 'attr-name', 'attr-val',
      'user-uuid',
      new Date('2015-01-01 10:00:00'), 2, true,
      new Date('2015-01-02 10:00:00'), 'super-uuid');
    return rec.create().then(function () {
      return recs.get();
    }).then(function (rows) {
      utils.contains([{
        id: QueueAttrRecs.ID_LAST_RESERVED + 1,
        col_name: 'col',
        doc_uuid: 'doc-uuid',
        attr_name: 'attr-name',
        attr_val: 'attr-val',
        user_uuid: 'user-uuid',
        updated_at: new Date('2015-01-01 10:00:00'),
        seq: 2,
        quorum: true,
        recorded_at: new Date('2015-01-02 10:00:00'),
        super_uuid: 'super-uuid'
      }], rows);
    });
  });

  it('should destroy', function () {
    var rec = new QueueAttrRec(sql, null, 'col', 'doc-uuid', 'attr-name', 'attr-val',
      'user-uuid',
      new Date('2015-01-01 10:00:00'), 0, false);
    return rec.create().then(function () {
      var rec2 = new QueueAttrRec(sql, QueueAttrRecs.ID_LAST_RESERVED + 1);
      return rec2.destroy();
    }).then(function () {
      return recs.get();
    }).then(function (rows) {
      (rows === null).should.eql(true);
    });
  });

  // TODO: test queue w/o docUUID

});
