'use strict';

// TODO: split into Docs, Doc, DocRecs, DocRec

var constants = require('../constants'),
  System = require('../../../system');

var Docs = function (partitions, attrs, policy, cols) {
  this._partitions = partitions;
  this._attrs = attrs;
  this._policy = policy;
  this._cols = cols;
};

// TODO: create a data type for creating indexes like this
Docs.ID_LESS = {};
Docs.ID_LESS[System.DB_ATTR_NAME] = true;

Docs.isIdLess = function (name) {
  return Docs.ID_LESS[name] ? true : false;
};

Docs.prototype._restore = function (docId, restore) {
  // 1. Get LATEST doc
  // 2. Add attrs and update doc for ALL
  // 3. Update LATEST attrs and doc
  var self = this;
  return self._partitions[constants.LATEST]._attrRecs.getDoc(docId, restore.updatedAt)
    .then(function (attrs) {
      return self._attrs.createLatestAndAllAndRecentAndRecentAttrs(attrs, restore.updatedAt,
        true,
        restore.docUUID, restore.colId,
        restore.userUUID);
    });
};

Docs.prototype._restoreIfChangeSince = function (docId, changedByUserId, destroyedAt, docUUID,
  colId, userUUID) {
  var self = this;
  return self._partitions[constants.LATEST]._attrRecs.earliestNonDestroyUpdateSince(docId,
      destroyedAt)
    .then(function (attr) {
      if (attr) {
        // Is this a form of an auto restore? e.g. the change to "priority" happened after the doc
        // was destroyed:
        // [ { col: 'task', id: '1', name: 'priority', val: 'medium',
        //     up: '2014-01-01T10:02:00.000Z' },
        //   { col: 'task', id: '1', del: '2014-01-01T10:01:00.000Z', // delete doc
        //     up: '2014-01-01T10:01:00.000Z' } ];
        return self._restore(docId, {
          changedByUserId: changedByUserId,
          updatedAt: attr.updated_at,
          docUUID: docUUID,
          colId: colId,
          userUUID: userUUID
        });
      }
    });
};

Docs.prototype.destroy = function (partition, docId, changedByUserId, updatedAt, restore, docUUID,
  colId, userUUID) {
  var self = this;
  updatedAt = new Date(updatedAt);
  return self._partitions[partition]._docs.setDestroyedAt(docId, updatedAt)
    .then(function (results) {
      // Prevent infinite recursion by checking restore flag
      // No update, no restore, LATEST?
      if (results && results.affected === 0 && !restore && partition === constants.LATEST) {
        return self._restoreIfChangeSince(docId, changedByUserId, updatedAt, docUUID, colId,
          userUUID);
      }
    });
};

Docs.prototype._canCreate = function (colId, docUUID, userId) {
  return this._policy.modPermitted(userId, constants.ACTION_CREATE, colId, docUUID);
};

Docs.prototype._createDoc = function (partition, colName, docUUID, userId, updatedAt, attrName,
  changedByUUID, recordedByUserId) {
  var self = this;
  return self._cols.getOrCreateColId(colName, changedByUUID, updatedAt, recordedByUserId).then(
    function (colId) {
      var destroyedAt = null,
        recordedAt = null,
        attrVal = null,
        force = true;
      return self._partitions[partition]._docs.getOrCreate(docUUID, colId, userId, destroyedAt,
        recordedAt, updatedAt, attrName, attrVal,
        force, recordedByUserId);
    });
};

module.exports = Docs;