'use strict';

// TODO: move userId, changedByUserId, destroyedAt, recordedAt, updatedAt to be in doc, e.g.
// $userId, $destroyedAt, etc...???

// TODO: create DocParams and pass into constructor? Then don't pass any params into create, update,
// etc...

// TODO: should doc deletions use seq nums to better determine priority when update and deletion
// done at the same time?

// TODO: separate DB specific logic to doc-rec & doc-recs and use doc and docs for layer above

var constants = require('../constants'),
  SQLError = require('../../../orm/sql/common/sql-error'),
  ForbiddenError = require('../forbidden-error');

var DocRecs = function (sql, partition, policy, attrRecs, userRoles) {
  this._sql = sql;
  this._partition = partition;
  this._name = partition + DocRecs.NAME;
  this._policy = policy;
  this._attrRecs = attrRecs;
  this._userRoles = userRoles;
};

DocRecs.NAME = 'docs';
DocRecs.ID_LAST_RESERVED = constants.ID_LAST_RESERVED;

DocRecs.prototype.createTable = function () {

  var self = this;

  var schema = {
    id: {
      type: 'primary'
    },
    uuid: {
      type: 'varbinary',
      length: 38,
      null: false,
      unique: true
    }, // 38 = 36 + prefix
    col_id: {
      type: 'key',
      null: false
    },
    user_id: {
      type: 'key'
    },

    // The last time this doc was deleted if the doc is still deleted or null if the doc is no
    // longer deleted
    destroyed_at: {
      type: 'datetime',
      index: true
    },

    // destroyed_at is cleared when the doc is updated and we need a way to track the last
    // destroyed_at to determine whether we need to perform an auto restore
    last_destroyed_at: {
      type: 'datetime',
      index: true
    },

    recorded_at: {
      type: 'datetime',
      default: 'currenttimestamp',
      null: false,
      index: true
    },

    // The last time this doc was updated (not including deletions)
    updated_at: {
      type: 'datetime',
      index: true
    } // can be null as doc may be created w/ del
  };

  return self._sql.createTable(self._name, schema, null, DocRecs.ID_LAST_RESERVED);

};

DocRecs.prototype.truncateTable = function () {
  return this._sql.truncateTable(this._name, 'id', DocRecs.ID_LAST_RESERVED);
};

DocRecs.prototype.create = function (uuid, colId, userId, destroyedAt, recordedAt, updatedAt) {
  return this._sql.insert({
    uuid: uuid,
    col_id: colId,
    user_id: userId,
    destroyed_at: destroyedAt,
    last_destroyed_at: destroyedAt,
    updated_at: updatedAt
  }, this._name, 'id');
};

DocRecs.prototype.getId = function (uuid) {
  return this._sql.find(['id'], this._name, null, ['uuid', '=', '"' + uuid + '"'])
    .then(function (results) {
      return results.rows ? results.rows[0].id : null;
    });
};

DocRecs.prototype.getUUID = function (id) {
  return this._sql.find(['uuid'], this._name, null, ['id', '=', '"' + id + '"'])
    .then(function (results) {
      return results.rows ? results.rows[0].uuid : null;
    });
};

DocRecs.prototype.get = function (uuid) {
  return this._sql.find(['id', 'destroyed_at'], this._name, null, ['uuid', '=', '"' + uuid + '"'])
    .then(function (results) {
      return results.rows ? results.rows[0] : null;
    });
};

DocRecs.prototype.getOrCreate = function (docUUID, colId, userId, destroyedAt, recordedAt,
  updatedAt) {
  var self = this;
  return self.get(docUUID).then(function (doc) {
    if (doc) {
      return doc.id;
    }

    return self.create(docUUID, colId, userId, destroyedAt, recordedAt, updatedAt)
      .catch(function (err) {
        if (!(err instanceof SQLError)) {
          throw err;
        }
        return self.getId(docUUID);
      });
  });
};

DocRecs.prototype.update = function (docId, updatedAt) {
  var self = this;

  // Set recorded_at to now so that old docs that haven't been updated in a while can be safely
  // archived. Set destroyed_at to null as an update that follows a doc deletion should clear the
  // deletion
  var record = {
    updated_at: updatedAt,
    recorded_at: new Date(),
    destroyed_at: null
  };

  // Use < for destroyed_at so that deletions take priority. It is possible that an update and a doc
  // deletion occur at the same time and we have no notion of a seq num to determine priority so we
  // will assume that the doc deletion is the latest change.
  var where = [
    [
      ['updated_at', '<', '"' + updatedAt.toISOString() + '"'], 'or', ['updated_at', '=',
        'null'
      ]
    ], 'and', [
      ['destroyed_at', '=', 'null'], 'or', ['destroyed_at', '<', '"' + updatedAt.toISOString() +
        '"'
      ]
    ]
  ];

  return self._sql.update(record, self._name, [
    ['id', '=', '"' + docId + '"'], 'and',
    where
  ]).then(function () {
    // The update may not have succeeded as a delete came first, but we may still need to update
    // updated_at
    return self._sql.update({
      updated_at: updatedAt
    }, self._name, [
      ['id', '=', '"' + docId + '"'], 'and', [
        ['updated_at', '<=', '"' + updatedAt.toISOString() + '"'], 'or', ['updated_at',
          '=', 'null'
        ]
      ]
    ]);
  });
};

DocRecs.prototype.lastDestroyedAt = function (docId) {
  return this._sql.find(['last_destroyed_at'], this._name, null, ['id', '=', '"' + docId + '"'])
    .then(function (results) {
      return results.rows ? results.rows[0].last_destroyed_at : null;
    });
};

DocRecs.prototype.setDestroyedAt = function (docId, destroyedAt) {
  var where = ['id', '=', '"' + docId + '"'];
  // Use <= so that we trigger an update to docs that can be used to determine whether we need to
  // update
  return this._sql.update({
    destroyed_at: destroyedAt,
    last_destroyed_at: destroyedAt
  }, this._name, [where, 'and', ['updated_at', '<=', '"' + destroyedAt.toISOString() + '"'],
    'and', [
      ['destroyed_at', '<=', '"' + destroyedAt.toISOString() + '"'], 'or', ['destroyed_at',
        '=', 'null'
      ]
    ]
  ]);
};

DocRecs.prototype.destroyBefore = function (before) {
  return this._sql.destroy(this._name, ['recorded_at', '<', '"' + before.toISOString() + '"']);
};

DocRecs.prototype.getUserRoleDocUUID = function (userId, roleId) {
  var self = this;
  return self._userRoles.getDocId(userId, roleId).then(function (docId) {
    if (docId) {
      return self.getUUID(docId);
    }
  });
};

DocRecs.prototype.findUUID = function (attrName, attrVal) {
  var self = this;
  return self._attrRecs.findDoc(attrName, attrVal).then(function (docId) {
    if (docId) {
      return self.getUUID(docId);
    }
  });
};

module.exports = DocRecs;