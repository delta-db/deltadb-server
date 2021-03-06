'use strict';

var commonUtils = require('deltadb-common-utils'),
  constants = require('../constants'),
  core = require('../core'),
  AttrRecs = require('./attr-recs');

// AttrRec should closely mimic the attrs table, e.g. the value of the attr is stored in JSON
var AttrRec = function (sql, partition, params, partitioner) {
  this._sql = sql;
  this._partition = partition;
  this._name = partition + AttrRecs.NAME;
  this._params = this._toRec(params);
  this._partitioner = partitioner;
};

AttrRec.ACTION_ADD = 'add';
AttrRec.ACTION_REMOVE = 'remove';

AttrRec.prototype._stringify = function (col) {
  // Store undefined as null in DB
  return typeof col === 'undefined' ? null : JSON.stringify(col);
};

AttrRec.prototype._toRec = function (params) {
  var rec = commonUtils.merge({}, params); // use merge so that original col isn't modified
  rec.value = this._stringify(rec.value);
  rec.uid = rec.userUUID;
  return rec;
};

AttrRec.prototype._rec = function () {
  return {
    doc_id: this._params.docId,
    name: this._params.name,
    value: this._params.value,
    changed_by_user_id: this._params.changedByUserId,
    updated_at: this._params.updatedAt,
    seq: this._params.seq ? this._params.seq : 0,
    quorum: this._params.quorum,
    recorded_at: new Date(),
    omit: core.reserved(this._params.name)
  };
};

AttrRec.prototype._createRec = function () {
  return this._sql.insert(this._rec(), this._name, 'id');
};

// TODO: consolidate create and _createRec to create
AttrRec.prototype.create = function () {
  return this._createRec();
};

AttrRec.prototype.getId = function () {
  return this._sql.find(['id'], this._name, null, [
    // optimize query by first searching by indexed attrs
    ['doc_id', '=', '"' + this._params.docId + '"'], 'and', ['name', '=', this._params.name ?
      '"' + this._params.name + '"' : 'null'
    ], 'and', ['updated_at', '=',
      this._params.updatedAt ? '"' + this._params.updatedAt.toISOString() + '"' : 'null'
    ], 'and', ['seq', '=', '"' + this._params.seq + '"'], 'and', ['quorum', '=', this._params
      .quorum ? '"' + this._params.quorum + '"' : 'null'
    ], 'and',

    // value for last as it isn't indexed so the comparison is the slowest
    ['value', '=', this._params.value ? '"' + this._params.value + '"' : 'null'],
  ], null, 1).then(function (results) {
    return results.rows ? results.rows[0].id : null;
  });
};

AttrRec.prototype.createIfMissing = function () {
  // Note: it is possible that a race condition will lead to an attr being written by another thread
  // in between this thread checking for no duplicate attr and writing the attr. This is OK though
  // as we only do this check to prevent an inifinite recording loop and a rare race conditions here
  // and there will just lead to a piece of data being sent to a server twice. The extra data will
  // eventually be ignored.
  var self = this;
  return self.getId().then(function (id) {
    if (!id) { // doesn't exist?
      return self.create();
    }
  });
};

// Note: the data is completely deterministic and eventually consistent (TSV Conflict Resolution):
// 1. Timestamp: Latest updated_at wins
// 2. Sequence: If updated_at the same then highest seq wins
// 3. Value: If updated_at the same and seq the same then highest value wins
AttrRec.prototype.update = function () {
  var before = [
    ['updated_at', '<', '"' + this._params.updatedAt.toISOString() + '"'], 'or', [
      ['updated_at', '=', '"' + this._params.updatedAt.toISOString() + '"'], 'and', ['seq', '<',
        '"' + this._params.seq + '"'
      ]
    ], 'or', [
      ['updated_at', '=', '"' + this._params.updatedAt.toISOString() + '"'], 'and', ['seq', '=',
        '"' + this._params.seq + '"'
      ], 'and', ['value', '<=', '"' + this._params.value + '"']
    ]
  ]; // <= for quorum updates

  // Only replace if later change
  var where = [
    ['doc_id', '=', '"' + this._params.docId + '"'], 'and', ['name', '=', this._params.name ?
      '"' + this._params.name + '"' : 'null'
    ], 'and',
    before
  ];

  return this._sql.update(this._rec(), this._name, where);
};

AttrRec.prototype.replace = function () {
  var self = this;
  return self.create().catch(function (err) {
    if (!commonUtils.errorInstanceOf(err, 'SQLError')) {
      throw err;
    }
    return self.update();
  });
};

AttrRec.prototype.createOrReplace = function () {
  if (this._partition === constants.LATEST) {
    return this.replace();
  } else {
    // To prevent an infinite recording loop, e.g. a->b->c->a, we need ALL and RECENT to ignore
    // duplicate changes
    return this.createIfMissing();
  }
};

module.exports = AttrRec;
