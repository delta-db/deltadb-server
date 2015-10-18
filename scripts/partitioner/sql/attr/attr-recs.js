'use strict';

var constants = require('../constants');

var AttrRecs = function (sql, partition) {
  this._sql = sql;
  this._partition = partition;
  this._name = partition + AttrRecs.NAME;
};

AttrRecs.NAME = 'attrs';
AttrRecs.ID_LAST_RESERVED = constants.ID_LAST_RESERVED;

AttrRecs.prototype.createTable = function () {

  var self = this;

  var schema = {
    id: {
      type: 'primary'
    },
    doc_id: {
      type: 'key',
      null: false
    },
    name: {
      type: 'varchar',
      length: 100,
      index: true
    },
    value: {
      type: 'text'
    },
    changed_by_user_id: {
      type: 'key'
    },
    seq: {
      type: 'smallint',
      null: false
    }, // e.g. needed for set('n', 1); set('n', 2);
    recorded_at: {
      type: 'datetime',
      default: 'currenttimestamp',
      null: false,
      index: true
    },
    updated_at: {
      type: 'datetime',
      default: 'currenttimestamp',
      null: false,
      index: true
    },
    quorum: {
      type: 'boolean',
      index: true
    }, // true if at least 2 servers have attr recorded

    // true if this data should be ommitted from the changes feed by default
    omit: {
      type: 'boolean',
      null: false,
      index: true
    },

    // TODO: after refactor QUEUE to use files, remove this attr as not needed for other partitions
    uid: {
      type: 'varbinary',
      length: 36
    } // userUUID

  };

  var unique = null;
  if (this._partition === constants.LATEST) {
    unique = [{
      attrs: ['doc_id', 'name'],
      full: ['name']
    }, {
      attrs: ['doc_id'],
      null: ['name']
    }];
  }

  return self._sql.createTable(self._name, schema, unique, AttrRecs.ID_LAST_RESERVED);

};

AttrRecs.prototype.truncateTable = function () {
  return this._sql.truncateTable(this._name, 'id', AttrRecs.ID_LAST_RESERVED);
};

AttrRecs.prototype.destroyBefore = function (before) {
  return this._sql.destroy(this._name, ['recorded_at', '<', '"' + before.toISOString() + '"']);
};

AttrRecs.prototype.getDoc = function (docId, updatedBefore) {
  return this._sql.find(null, this._name, null, [
      ['doc_id', '=', '"' + docId + '"'], 'and', ['name', '!=', 'null'], 'and', ['updated_at',
        '<=', '"' + updatedBefore.toISOString() + '"'
      ]
    ])
    .then(function (results) {
      return results && results.rows ? results.rows : null;
    });
};

AttrRecs.prototype.findDoc = function (attrName, attrVal) {
  return this._sql.find(['doc_id'], this._name, null, [
      ['name', '=', '"' + attrName + '"'], 'and', ['value', '=', '"' + JSON.stringify(attrVal) +
        '"'
      ]
    ])
    .then(function (results) {
      return results && results.rows ? results.rows[0].doc_id : null;
    });
};

AttrRecs.prototype.earliestNonDestroyUpdateSince = function (docId, since) {
  return this._sql.find(null, this._name, null, [
      ['doc_id', '=', '"' + docId + '"'], 'and', ['updated_at', '>', '"' + since.toISOString() +
        '"'
      ], 'and', ['name', '!=', 'null']
    ])
    .then(function (results) {
      return results.rows ? results.rows[0] : null;
    });
};

module.exports = AttrRecs;
