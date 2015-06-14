'use strict';

var constants = require('../constants');

var AttrRoles = function (sql, partition) {
  this._sql = sql;
  this._partition = partition;
  this._name = partition + AttrRoles.NAME;
};

AttrRoles.NAME = 'attr_roles';
AttrRoles.ID_LAST_RESERVED = constants.ID_LAST_RESERVED;

AttrRoles.prototype.createTable = function () {

  var self = this;

  var schema = {
    id: {
      type: 'primary'
    },
    col_id: {
      type: 'key'
    },
    name: {
      type: 'varchar',
      length: 100,
      index: true
    },
    role_id: {
      type: 'key',
      null: false
    },
    action: {
      type: 'smallint',
      null: false
    }, // TODO: should this be an enum instead?      
    created_at: {
      type: 'datetime',
      default: 'currenttimestamp',
      null: false
    },
    updated_at: {
      type: 'datetime',
      default: 'currenttimestamp',
      null: false
    }
  };

  return self._sql.createTable(self._name, schema, null, AttrRoles.ID_LAST_RESERVED);

};

AttrRoles.prototype.truncateTable = function () {
  return this._sql.truncateTable(this._name, 'id', AttrRoles.ID_LAST_RESERVED);
};

module.exports = AttrRoles;