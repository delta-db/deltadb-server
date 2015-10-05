'use strict';

var Promise = require('bluebird'),
  utils = require('../../../utils'),
  constants = require('../constants'),
  core = require('../core'),
  AttrRecs = require('./attr-recs'),
  System = require('../../../system'),
  Docs = require('../doc/docs'),
  SQLError = require('../../../orm/sql/common/sql-error');

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
  // In DB, don't store 'null' (a string), store null
  return col === null ? null : JSON.stringify(col);
};

AttrRec.prototype._transformValue = function (rec) {
  // Transform value so that we can reuse the create/destroy mechanisms native to the DB
  if (Docs.isIdLess(rec.name)) { // an id-less change
// console.log('AttrRec.prototype._transformValue, rec=', rec);
    this._origValue = rec.value;
    var action = JSON.parse(rec.value);
    if (action.action === AttrRec.ACTION_ADD) {
      rec.value = JSON.stringify(action.name);
    } else { // remove doc
      rec.name = null;
      rec.value = null;
    }
  }
};

// TODO: remove
// AttrRec.prototype._transformValue = function (rec) {
//   // Transform value so that we can reuse the create/destroy mechanisms native to the DB
//   if (Docs.isIdLess(rec.name)) { // an id-less change
//     this._origValue = rec.value;
//     if (rec.value) { // was the value already transformed?
//       var action = JSON.parse(rec.value);
//       if (action.action) { // not already transformed?
//         if (action.action === AttrRec.ACTION_ADD) {
//           rec.value = JSON.stringify(action.name);
//         } else { // remove doc
//           rec.name = null;
//           rec.value = null;
//         }    
//       }
//     }
//   }
// };

AttrRec.prototype._toRec = function (params) {
  var rec = utils.merge({}, params); // use merge so that original col isn't modified
  rec.value = this._stringify(rec.value);
  rec.uid = rec.userUUID;
  this._transformValue(rec);
  return rec;
};

AttrRec.prototype._rec = function () {
  return {
    doc_id: this._params.docId,
    name: this._params.name,
    value: this._params.value,
    changed_by_user_id: this._params.changedByUserId,
    updated_at: this._params.updatedAt,
    seq: (typeof this._params.seq === 'undefined' || this._params.seq === null ? 0 : this._params
      .seq),
    quorum: this._params.quorum,
    uid: this._params.uid,
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
    // optimize query but first searching by indexed attrs
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
    if (!(err instanceof SQLError)) {
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