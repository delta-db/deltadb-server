'use strict';

// We have to work with roleUUIDs and not names as in some apps the users may be able to create
// their own roles, e.g. when creating a role to share a specific doc and we need to ensure that two
// users can't create conflicting roles.

var Promise = require('bluebird'),
  commonUtils = require('deltadb-common-utils'),
  constants = require('./constants'),
  Cols = require('./col/cols'),
  SQLError = require('../../orm/sql/common/sql-error');

var Roles = function (sql, partitioner) {
  this._sql = sql;
  this._partitioner = partitioner;
};

Roles.NAME = 'roles';
Roles.ID_LAST_RESERVED = constants.ID_LAST_RESERVED;

// Use a prefix so that role UUIDs don't conflict with UUIDs of other docs
Roles.UUID_PRE = '$r';

Roles.ID_SUPER = 1;
Roles.SUPER = '$super'; // $super is used behind the scenes and allows servers to sync w/ each other

Roles.ID_OWNER = 2;
Roles.OWNER = '$owner';

Roles.ID_ALL = 3;
Roles.ALL = '$all';

Roles.prototype.createTable = function () {

  var self = this;

  var schema = {
    id: {
      type: 'primary'
    },
    uuid: {
      type: 'varbinary',
      length: 38
    }, // 36 + prefix
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

  //  return self._sql.dropTable(Roles.NAME).then(function () {
  return self._sql.createTable(Roles.NAME, schema, null, Roles.ID_LAST_RESERVED).then(function () {
    return self.createReservedRoles();
  });

};

Roles.prototype.truncateTable = function () {
  var self = this;
  return self._sql.truncateTable(Roles.NAME, 'id', Roles.ID_LAST_RESERVED).then(function () {
    return self.createReservedRoles();
  });
};

Roles.prototype.createRoleUsersCol = function (roleUUID, userId, userUUID, updatedAt) {
  var roleName = this.toName(roleUUID);

  // Owner doesn't get roleUsers as this these permissions are automatically determined by whether
  // the user is the doc owner. The All role doesn't need roleUsers as everyone already has this
  // role.
  if (roleName === Roles.OWNER || roleName === Roles.ALL) {
    return Promise.resolve();
  }

  var colName = this.toColName(roleName);
  return this._partitioner._cols.getOrCreateIfPermitted(colName, userId, userUUID, updatedAt);
};

Roles.prototype.create = function (uuid, changedByUserId, changedByUUID, updatedAt, id) {
  var self = this;
  return self._sql.insert({
    id: id,
    uuid: uuid
  }, Roles.NAME, 'id').then(function (roleId) {
    return self.createRoleUsersCol(uuid, changedByUserId, changedByUUID, updatedAt)
      .then(function () {
        return roleId;
      });
  });
};

Roles.prototype.reservedRoles = function () {
  var ids = {};
  ids[Roles.SUPER] = Roles.ID_SUPER;
  ids[Roles.OWNER] = Roles.ID_OWNER;
  ids[Roles.ALL] = Roles.ID_ALL;
  return ids;
};

Roles.prototype.createReservedRoles = function () {
  var self = this,
    cols = self.reservedRoles(),
    promises = [];
  commonUtils.each(cols, function (id, name) {
    var uuid = self.toUUID(name);
    promises.push(self.create(uuid, null, null, null, id));
  });
  return Promise.all(promises);
};

Roles.prototype.getRoleId = function (uuid) {
  // TODO: load into mem so don't have to keep hitting DB?
  return this._sql.find(['id'], Roles.NAME, null, ['uuid', '=', '"' + uuid + '"'])
    .then(function (results) {
      return results.rows ? results.rows[0].id : null;
    });
};

Roles.prototype.getOrCreateRole = function (uuid, changedByUserId, changedByUUID, updatedAt) {
  var self = this;
  return self.getRoleId(uuid).then(function (id) {
    if (id) {
      return id;
    }
    return self.create(uuid, changedByUserId, changedByUUID, updatedAt)
      .catch(function (err) { // did another process add the role?
        if (!(err instanceof SQLError)) {
          throw err;
        }
        return self.getRoleId(uuid);
      });
  });
};

Roles.prototype.getOrCreateRoles = function (uuids, changedByUserId, changedByUUID) {
  var self = this,
    promises = [],
    ids = self.reservedRoles();
  uuids.forEach(function (uuid) {
    promises.push(self.getOrCreateRole(uuid, changedByUserId, changedByUUID).then(function (
      id) {
      ids[uuid] = id;
    }));
  });
  return Promise.all(promises).then(function () {
    return ids;
  });
};

Roles.prototype.getImplicitRole = function (userUUID) {
  return this.toUUID(userUUID);
};

// Converts to roleUUID
Roles.prototype.toUUID = function (roleName) {
  // Used so that we can specify the shorthand in the policy, i.e. w/o prefix
  return Roles.UUID_PRE + roleName;
};

Roles.prototype.toName = function (roleUUID) {
  return roleUUID.replace(/\$r/, '');
};

Roles.prototype.toUserUUID = function (colName) {
  return colName.replace(/\$ur/, '');
};

Roles.prototype.toColName = function (roleName) {
  return Cols.NAME_PRE_ROLE_USERS + roleName;
};

module.exports = Roles;
