'use strict';

var Promise = require('bluebird'),
  commonUtils = require('deltadb-common-utils'),
  constants = require('../constants'),
  ForbiddenError = require('../forbidden-error'),
  clientUtils = require('deltadb/scripts/utils');

var Cols = function (sql, policy) {
  this._sql = sql;
  this._policy = policy;
};

Cols.NAME = 'cols';

Cols.ID_ALL = 1;
Cols.ALL = clientUtils.COL_NAME_ALL;

Cols.ID_USER = 2;
Cols.USER = '$user';

// TODO: probably need to update w/ new role user funct
Cols.ID_ROLE_USERS_SUPER = 3;
Cols.ROLE_USERS_SUPER = '$ru$super';

Cols.ID_USER_ROLES_SUPER = 4;
Cols.USER_ROLES_SUPER = '$ur$super';

Cols.NAME_PRE_ROLE_USERS = '$ru';
Cols.NAME_PRE_USER_ROLES = clientUtils.NAME_PRE_USER_ROLES;

Cols.ID_LAST_RESERVED = constants.ID_LAST_RESERVED;

Cols.prototype.createTable = function () {

  var self = this;

  var schema = {
    id: {
      type: 'primary'
    },
    name: {
      type: 'varchar',
      length: 100,
      null: false,
      unique: true
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

  return self._sql.createTable(Cols.NAME, schema, null, Cols.ID_LAST_RESERVED).then(function () {
    return self.createReservedCols();
  });

};

Cols.prototype.truncateTable = function () {
  var self = this;
  return self._sql.truncateTable(Cols.NAME, 'id', Cols.ID_LAST_RESERVED).then(function () {
    return self.createReservedCols();
  });
};

Cols.prototype.create = function (name, updatedAt, id) {
  return this._sql.insert({
      id: id,
      name: name,
      updated_at: updatedAt ? updatedAt : new Date()
    },
    Cols.NAME, 'id');
};

Cols.prototype.reservedCols = function () {
  var ids = {};
  ids[Cols.ALL] = Cols.ID_ALL;
  ids[Cols.USER] = Cols.ID_USER;
  ids[Cols.ROLE_USERS_SUPER] = Cols.ID_ROLE_USERS_SUPER;
  ids[Cols.USER_ROLES_SUPER] = Cols.ID_USER_ROLES_SUPER;
  return ids;
};

Cols.prototype.createReservedCols = function () {
  var self = this,
    cols = self.reservedCols(),
    promises = [];
  commonUtils.each(cols, function (id, name) {
    promises.push(self.create(name, null, id));
  });
  return Promise.all(promises);
};

Cols.prototype.getColId = function (name) {
  // TODO: load into mem so don't have to keep hitting DB?
  return this._sql.find(['id'], Cols.NAME, null, ['name', '=', '"' + name + '"'])
    .then(function (results) {
      return results.rows ? results.rows[0].id : null;
    });
};

Cols.prototype.getOrCreateColId = function (name, userUUID, updatedAt) {
  var self = this;
  return self.getColId(name).then(function (id) {
    if (id) {
      return id;
    }
    return self.createColAndDefaultPolicies(name, userUUID, updatedAt).catch(function () {
      // A race condition caused by back-to-back changes on the same col can result in subsequent
      // inserts failing so we do a lookup upon failure.
      // TODO: worry about this for all other tables??? Need to test with unit tests
      return self.getColId(name);
    });
  });
};

Cols.prototype.getOrCreateIfPermitted = function (colName, userId, userUUID, updatedAt,
  recordedByUserId) {
  var self = this;
  recordedByUserId = recordedByUserId ? recordedByUserId : userId;
  return self._canCreate(colName, recordedByUserId).then(function (allowed) {
    if (!allowed) {
      throw new ForbiddenError('cannot create col ' + colName);
    }
    // Use getOrCreateColId as race condition could have just created col and getOrCreateColId
    // also creates default policies
    return self.getOrCreateColId(colName, userUUID, updatedAt);
  });
};

// Create the col record and the default col policy
Cols.prototype.createColAndDefaultPolicy = function (name, userUUID, updatedAt) {
  var self = this;
  return self.create(name, updatedAt).then(function (colId) {
    // TODO: pass updatedAt to createDefaultPolicy
    return self._policy.createDefaultPolicy(colId, userUUID).then(function () {
      return colId;
    });
  });
};

// Create the col record and the default policies (DB & col)
Cols.prototype.createColAndDefaultPolicies = function (name, userUUID, updatedAt) {
  var self = this;
  // TODO: pass updatedAt to createDefaultPolicy
  return self._policy.createDefaultPolicy(Cols.ID_ALL, userUUID).then(function () {
    return self.createColAndDefaultPolicy(name, userUUID, updatedAt);
  });
};

Cols.prototype._canCreate = function (colName, userId) {
  // Cols.ID_ALL policy dictates whether we can create a new collection
  return this._policy.modPermitted(userId, constants.ACTION_CREATE, Cols.ID_ALL);
};

module.exports = Cols;
