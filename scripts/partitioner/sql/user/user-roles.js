'use strict';

var Promise = require('bluebird'),
  utils = require('../../../utils'),
  constants = require('../constants'),
  Roles = require('../roles'),
  Users = require('./users'),
  SQLError = require('../../../orm/sql/common/sql-error');

var UserRoles = function (sql) {
  this._sql = sql;
};

UserRoles.NAME = 'user_roles';
UserRoles.ID_LAST_RESERVED = constants.ID_LAST_RESERVED;

UserRoles.ID_SUPER = 1;

// Use a prefix so that the role user docUUID can be derived
UserRoles.UUID_PRE = '$g';

UserRoles.ACTION_ADD = 'add';
UserRoles.ACTION_REMOVE = 'remove';

UserRoles.prototype.toRoleUserDocUUID = function (userRoleDocUUID) {
  return UserRoles.UUID_PRE + userRoleDocUUID;
};

UserRoles.prototype.createTable = function () {

  var self = this;

  var schema = {
    id: {
      type: 'primary'
    },
    user_id: {
      type: 'key',
      null: false
    },
    role_id: {
      type: 'key',
      null: false
    },

    // docId of LATEST user role doc as otherwise we'd have to store a docUUID like
    // docUUID=userUUID+roleUUID, which would double the size of our docUUID
    doc_id: {
      type: 'key'
    }, // can be null for system roles

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

  var unique = [{
    attrs: ['user_id', 'role_id']
  }];

  return self._sql.createTable(UserRoles.NAME, schema, unique, UserRoles.ID_LAST_RESERVED).then(
    function () {
      return self._createReservedUserRoles();
    });

};

UserRoles.prototype.truncateTable = function () {
  var self = this;
  return self._sql.truncateTable(UserRoles.NAME, 'id', UserRoles.ID_LAST_RESERVED)
    .then(function () {
      return self._createReservedUserRoles();
    });
};

UserRoles.prototype.create = function (userId, roleId, docId, id) {
  return this._sql.insert({
    id: id,
    user_id: userId,
    role_id: roleId,
    doc_id: docId
  }, UserRoles.NAME, 'id');
};

UserRoles.prototype._reservedUserRoles = function () {
  var userRoles = {};
  userRoles[UserRoles.ID_SUPER] = {
    userId: Users.ID_SUPER,
    roleId: Roles.ID_SUPER
  };
  return userRoles;
};

UserRoles.prototype._createReservedUserRoles = function () {
  var self = this,
    userRoles = self._reservedUserRoles(),
    promises = [];
  utils.each(userRoles, function (userRole, id) {
    promises.push(self.create(userRole.userId, userRole.roleId, null, id));
  });
  return Promise.all(promises);
};

UserRoles.prototype.getId = function (userId, roleId) {
  return this._sql.find(['id'], UserRoles.NAME, null, [
      ['user_id', '=', '"' + userId + '"'], 'and', ['role_id', '=', '"' + roleId + '"']
    ])
    .then(function (results) {
      return results.rows ? results.rows[0].id : null;
    });
};

UserRoles.prototype.isSuperUser = function (userId) {
  if (!userId) {
    return Promise.resolve(false);
  }
  return this.getId(userId, Roles.ID_SUPER).then(function (userRoleId) {
    if (userRoleId) {
      return true;
    }
  });
};

UserRoles.prototype.getOrCreate = function (userId, roleId, docId) {
  var self = this;
  return self.getId(userId, roleId).then(function (id) {
    if (id) {
      return id;
    }
    return self.create(userId, roleId, docId)
      .catch(function (err) { // did another process create the user role?
        if (!(err instanceof SQLError)) {
          throw err;
        }
        return self.getId(userId, roleId);
      });
  });
};

UserRoles.prototype.destroy = function (userId, roleId) {
  return this._sql.destroy(UserRoles.NAME, [
    ['user_id', '=', '"' + userId + '"'], 'and', ['role_id', '=', '"' + roleId + '"']
  ]);
};

UserRoles.prototype.getDocId = function (userId, roleId) {
  return this._sql.find(['doc_id'], UserRoles.NAME, null, [
      ['user_id', '=', '"' + userId + '"'], 'and', ['role_id', '=', '"' + roleId + '"']
    ])
    .then(function (results) {
      return results.rows ? results.rows[0].doc_id : null;
    });
};

module.exports = UserRoles;