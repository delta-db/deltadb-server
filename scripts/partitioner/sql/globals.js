'use strict';

// TODO: unit tests!!

var constants = require('./constants');

var Globals = function (sql) {
  this._sql = sql;
};

Globals.NAME = 'globals';
Globals.ID_LAST_RESERVED = constants.ID_LAST_RESERVED;

Globals.prototype.createTable = function () {

  var self = this;

  var schema = {
    id: {
      type: 'primary'
    },
    name: {
      type: 'text',
      null: false,
      unique: true
    },
    value: {
      type: 'text'
    },
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

  return self._sql.createTable(Globals.NAME, schema, null, Globals.ID_LAST_RESERVED);

};

Globals.prototype.truncateTable = function () {
  return this._sql.truncateTable(Globals.NAME, 'id', Globals.ID_LAST_RESERVED);
};

Globals.prototype.get = function (name) {
  return this._sql.find(['value'], Globals.NAME, null, ['name', '=', '"' + name + '"'])
    .then(function (results) {
      return results.rows ? results.rows[0].value : null;
    });
};

Globals.prototype.set = function (name, value) {
  return this._sql.replace({
    name: name,
    value: value,
    updated_at: 'NOW()'
  }, Globals.NAME, 'id');
};

module.exports = Globals;