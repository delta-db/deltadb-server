'use strict';

// TODO: is the following comment still true??
// This class is only for attr parameters to simplify dependency injection, all other functionality
// is handled by Attr
var AttrParams = function (docId, name, value, changedByUserId, destroyedAt, recordedAt, updatedAt,
  seq, quorum, userUUID, colId, docUUID, forUserId, forUserUUID,
  recordedByUserId) {
  this.docId = docId;
  this.name = name;
  this.value = value;
  this.changedByUserId = changedByUserId;
  this.destroyedAt = destroyedAt;
  this.recordedAt = recordedAt;
  this.updatedAt = updatedAt;
  this.seq = seq;
  this.quorum = quorum;
  this.userUUID = userUUID;
  this.colId = colId;
  this.docUUID = docUUID;
  this.forUserId = forUserId;
  this.forUserUUID = forUserUUID;
  this.recordedByUserId = recordedByUserId;
};

AttrParams.prototype.setWithRow = function (row) {
  this.docId = row.doc_id;
  this.name = row.name;
  this.value = this.parse(row.value);
  this.changedByUserId = row.changed_by_user_id;
  this.destroyedAt = row.destroyed_at;
  this.recordedAt = row.recorded_at;
  this.updatedAt = row.updated_at;
  this.seq = row.seq;
  this.quorum = row.quorum;
  this.userUUID = row.uid;
  this.colId = row.col_id;
};

AttrParams.prototype.parse = function (json) {
  // An undefined value is treated the same as a null value
  return typeof json === 'undefined' ? null : JSON.parse(json);
};

module.exports = AttrParams;
