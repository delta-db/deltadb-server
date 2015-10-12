'use strict';

var constants = require('../constants');

var QueueAttrRecs = function (sql) {
  this._sql = sql;
};

QueueAttrRecs.NAME = 'queue_attrs';
QueueAttrRecs.ID_LAST_RESERVED = constants.ID_LAST_RESERVED;

QueueAttrRecs.prototype.createTable = function () {

  var self = this;

  var schema = {
    id: {
      type: 'primary'
    },
    col_name: {
      type: 'varchar',
      length: 100,
      null: false
    },
    doc_uuid: {
      type: 'varbinary',
      length: 38
    }, // 38 = 36 + prefix, can be null if modifying role
    attr_name: {
      type: 'varchar',
      length: 100
    },
    attr_val: {
      type: 'text'
    },
    user_uuid: {
      type: 'varbinary',
      length: 36
    }, // userUUID of author
    super_uuid: {
      type: 'varbinary',
      length: 36
    }, // userUUID of super user
    created_at: {
      type: 'datetime',
      default: 'currenttimestamp',
      null: false
    },
    recorded_at: {
      type: 'datetime',
      default: 'currenttimestamp',
      null: false
    },
    updated_at: {
      type: 'datetime',
      default: 'currenttimestamp',
      null: false
    },
    seq: {
      type: 'smallint'
    }, // for back-to-back changes w/ same updatedAt
    quorum: {
      type: 'boolean'
    } // true if quorum of servers have attr recorded
  };

  return self._sql.createTable(QueueAttrRecs.NAME, schema, null, QueueAttrRecs.ID_LAST_RESERVED);

};

QueueAttrRecs.prototype.truncateTable = function () {
  return this._sql.truncateTable(QueueAttrRecs.NAME, 'id', QueueAttrRecs.ID_LAST_RESERVED);
};

// TODO: make caller limit by pages
QueueAttrRecs.prototype.get = function () {
console.log('QueueAttrRecs.prototype.get1');
  return this._sql.find(null, QueueAttrRecs.NAME).then(function (results) {
console.log('QueueAttrRecs.prototype.get2');
    return results.rows ? results.rows : null;
  });
};

module.exports = QueueAttrRecs;
