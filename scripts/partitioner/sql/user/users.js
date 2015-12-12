'use strict';

var Promise = require('bluebird'),
  commonUtils = require('deltadb-common-utils'),
  constants = require('../constants'),
  SQLError = require('deltadb-orm-sql/scripts/common/sql-error'),
  MissingError = require('deltadb-orm-sql/scripts/common/missing-error'),
  AuthenticationError = require('../../../client/authentication-error'),
  DisabledError = require('../../../client/disabled-error'),
  Cols = require('../col/cols'),
  clientUtils = require('../../../client/utils');

var Users = function (sql, roles, userRoles, partitioner) {
  this._sql = sql;
  this._roles = roles;
  this._userRoles = userRoles;
  this._partitioner = partitioner;
};

// Use a prefix so that user UUIDs don't conflict with UUIDs of other docs
Users.UUID_PRE = clientUtils.UUID_PRE;

Users.toDocUUID = function () {
  return clientUtils.toDocUUID.apply(clientUtils, arguments);
};

Users.NAME = 'users';
Users.ID_LAST_RESERVED = constants.ID_LAST_RESERVED;

// a default super user for syncing servers
Users.ID_SUPER = 1;
Users.SUPER_UUID = '$super';
Users.SUPER_USER = '$super';
Users.SUPER_PWD = 'super';
Users.SUPER_SALT = null;

Users.STATUS_ENABLED = clientUtils.STATUS_ENABLED;
Users.STATUS_DISABLED = 'disabled';

Users.prototype.createTable = function () {

  var self = this;

  var schema = {
    id: {
      type: 'primary'
    },
    uuid: {
      type: 'varbinary',
      length: 36,
      unique: true
    },
    username: {
      type: 'varchar',
      length: 100,
      unique: true
    }, // can be null as user may have been recorded with another server
    salt: {
      type: 'varbinary',
      length: 29
    },
    password: {
      type: 'varbinary',
      length: 60
    }, // can be null as user may have been recorded with another server
    status: {
      type: 'enum',
      values: [Users.STATUS_ENABLED, Users.STATUS_DISABLED],
      null: false
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

  return self._sql.createTable(Users.NAME, schema, null, Users.ID_LAST_RESERVED).then(function () {
    return self._createReservedUsers();
  });

};

Users.prototype.truncateTable = function () {
  var self = this;
  return this._sql.truncateTable(Users.NAME, 'id', Users.ID_LAST_RESERVED).then(function () {
    return self._createReservedUsers();
  });
};

Users.prototype.create = function (userUUID, username, salt, password, status, updatedAt, id) {
  return this._sql.insert({
      id: id,
      uuid: userUUID,
      username: username,
      salt: salt,
      password: password,
      status: status ? status : Users.STATUS_ENABLED,
      updated_at: updatedAt
    },
    Users.NAME, 'id');
};

Users.prototype._hashPasswordAndCreate = function (userUUID, username, password, status, updatedAt,
  id) {
  var self = this;
  return commonUtils.genSaltAndHashPassword(password).then(function (hash) {
    return self.create(userUUID, username, hash.salt, hash.hash, status, updatedAt, id);
  });
};

Users.prototype._createUser = function (userUUID, username, salt, password, status, updatedAt, id) {
  if (salt) { // salt provided and pwd already hashed?
    return this.create(userUUID, username, salt, password, status, updatedAt, id);
  } else {
    return this._hashPasswordAndCreate(userUUID, username, password, status, updatedAt, id);
  }
};

Users.prototype._reservedUsers = function () {
  var users = {};
  users[Users.ID_SUPER] = {
    userUUID: Users.SUPER_UUID,
    username: Users.SUPER_USER,
    password: Users.SUPER_PWD,
    salt: Users.SUPER_SALT
  };
  return users;
};

Users.prototype._createReservedUsers = function () {
  var self = this,
    users = self._reservedUsers(),
    promises = [];
  commonUtils.each(users, function (user, id) {
    promises.push(self._createUser(user.userUUID, user.username, user.salt, user.password,
      Users.STATUS_ENABLED, new Date(), id));
  });
  return Promise.all(promises);
};

Users.prototype.update = function (userId, userUUID, username, salt, password, status, updatedAt) {
  // Use updatedAt to prevent race conditions
  return this._sql.update({
      uuid: userUUID,
      username: username,
      salt: salt,
      password: password,
      status: status
    },
    Users.NAME, [
      ['id', '=', '"' + userId + '"'], 'and',

      // Need to use <= as user could have automatically been created via same change
      // that will create/update user
      ['updated_at', '<=', '"' + updatedAt.toISOString() + '"']
    ]);
};

Users.prototype.createUserAndImplicitRole = function (userUUID, username, salt, password, status,
  updatedAt, changedByUserId, changedByUUID) {
  var self = this,
    userId = null;
  return self.create(userUUID, username, salt, password, status, updatedAt).then(function (
    _userId) {
    // TODO: make updatedAt propagate to addRole
    userId = _userId;
    var docUUID = commonUtils.uuid(); // Generate docUUID for user role
    var colName = Cols.NAME_PRE_USER_ROLES + userUUID;
    var attrName = null; // don't use Doc._roleName as this would create an inifinite loop
    return self._partitioner._docs._createDoc(constants.LATEST, colName, docUUID, userId,
      updatedAt, attrName, changedByUUID);
  }).then(function (docId) {
    return self.addRole(userId, self._roles.getImplicitRole(userUUID), null, userUUID,
      updatedAt, docId);
  }).then(function () {
    return userId;
  });
};

Users.prototype.createUserAndImplicitRoleOrGetId = function (userUUID, username, salt, password,
  status, updatedAt, changedByUserId, changedByUUID) {
  var self = this;
  return self.createUserAndImplicitRole(userUUID, username, salt, password, status, updatedAt,
      changedByUserId, changedByUUID)
    .catch(function (err) {
      // TODO: can SQL ORM generate SQLDuplicateError so that can throw other errors?
      if (!(err instanceof SQLError)) {
        throw err;
      }
      // avoid race condition where 2 threads try to create at the same time
      return self.getUserId(userUUID);
    });
};

Users.prototype.createUserAndImplicitRoleOrUpdateUser = function (userUUID, username, salt,
  password, status, updatedAt, changedByUserId, changedByUUID) {
  var self = this;
  return self.createUserAndImplicitRole(userUUID, username, salt, password, status, updatedAt,
      changedByUserId, changedByUUID)
    .catch(function (err) {
      if (!(err instanceof SQLError)) {
        throw err;
      }
      // avoid race condition where 2 threads try to create at the same time
      var userId = null;
      return self.getUserId(userUUID).then(function (_userId) {
        userId = _userId;
        return self.update(userId, userUUID, username, salt, password, status, updatedAt);
      }).then(function () {
        return userId;
      });
    });
};

Users.prototype.getOrCreateUserId = function (userUUID, updatedAt, changedByUserId, changedByUUID) {
  var self = this;
  return self.getUserId(userUUID).then(function (id) {
    if (id) {
      return id;
    }
    return self.createUserAndImplicitRoleOrGetId(userUUID, null, null, null, null, updatedAt,
      changedByUserId, changedByUUID);
  });
};

Users.prototype.getUserId = function (uuid) {
  return this._sql.find(['id'], Users.NAME, null, ['uuid', '=', '"' + uuid + '"'])
    .then(function (results) {
      return results.rows ? results.rows[0].id : null;
    });
};

Users.prototype.addRole = function (userId, roleUUID, changedByUserId, changedByUUID, updatedAt,
  docId) {
  var self = this;
  return self._roles.getOrCreateRole(roleUUID, changedByUserId, changedByUUID, updatedAt)
    .then(function (roleId) {
      return self._userRoles.getOrCreate(userId, roleId, docId);
    });
};

Users.prototype.removeRole = function (userId, roleUUID) {
  var self = this;
  return self._roles.getRoleId(roleUUID).then(function (roleId) {
    return self._userRoles.destroy(userId, roleId);
  });
};

Users.prototype.setUser = function (user, updatedAt, changedByUserId, changedByUUID) {
  return this.createUserAndImplicitRoleOrUpdateUser(user.uuid, user.username, user.salt,
    user.password, user.status, updatedAt, changedByUserId, changedByUUID);
};

Users.prototype.getUser = function (userId) {
  return this._sql.find(null, Users.NAME, null, ['id', '=', '"' + userId + '"']).then(function (
    results) {
    if (results && results.rows) {
      return results.rows[0];
    }
  });
};

Users.prototype.getSuperUser = function () {
  return this.getUser(Users.ID_SUPER);
};

Users.prototype._getSalt = function (username) {
  return this._sql.find(['salt'], Users.NAME, null, ['username', '=', '"' + username + '"']).then(
    function (results) {
      if (!results.rows) {
        throw new MissingError('user not found (username=' + username + ')');
      }
      return results.rows[0].salt;
    });
};

Users.prototype._authenticate = function (username, hashedPwd) {
  return this._sql.find(['id', 'uuid', 'status'], Users.NAME, null, [
    ['username', '=', '"' + username + '"'], 'and', ['password', '=', '"' + hashedPwd + '"']
  ]).then(function (results) {
    if (!results.rows) {
      throw new AuthenticationError('username (username=' + username +
        ') and/or password invalid');
    } else if (results.rows[0].status !== Users.STATUS_ENABLED) {
      throw new DisabledError('user (username=' + username + ') disabled');
    } else {
      return results.rows[0];
    }
  });
};

Users.prototype.authenticated = function (username, password, hashedPassword) {
  var self = this,
    promise = null;

  if (hashedPassword) { // password already hashed?
    promise = Promise.resolve({
      hash: hashedPassword
    });
  } else {
    promise = self._getSalt(username).then(function (salt) {
      return commonUtils.hashPassword(password, salt);
    });
  }

  return promise.then(function (hash) {
    return self._authenticate(username, hash.hash);
  });
};

module.exports = Users;
