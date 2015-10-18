'use strict';

var QueueAttrRecs = require('./queue-attr-recs');

var QueueAttrRec = function (sql, id, colName, docUUID, attrName, attrVal, userUUID, updatedAt, seq,
  quorum, recordedAt, superUUID) {
  this._sql = sql;
  this._id = id;
  this._colName = colName;
  this._docUUID = docUUID;
  this._attrName = attrName;
  this._attrVal = attrVal;
  this._userUUID = userUUID;
  this._superUUID = superUUID;
  this._updatedAt = updatedAt;
  this._seq = seq;
  this._quorum = quorum;
  this._recordedAt = recordedAt;
};

QueueAttrRec.prototype.create = function () {
  return this._sql.insert({
      col_name: this._colName,
      doc_uuid: this._docUUID,
      attr_name: this._attrName,
      attr_val: this._attrVal,
      user_uuid: this._userUUID,
      updated_at: this._updatedAt,
      seq: this._seq ? this._seq : 0,
      quorum: this._quorum,
      recorded_at: this._recordedAt,
      super_uuid: this._superUUID
    },
    QueueAttrRecs.NAME, 'id');
};

QueueAttrRec.prototype.destroy = function () {
  return this._sql.destroy(QueueAttrRecs.NAME, ['id', '=', '"' + this._id + '"']);
};

module.exports = QueueAttrRec;
