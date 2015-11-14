'use strict';

// TODO: move Cols.ALL up so not at SQL layer. Same for any other partitioner deps at SQL layer
var Cols = require('../partitioner/sql/col/cols'),
  Users = require('../partitioner/sql/user/users'),
  clientUtils = require('../client/utils'),
  Roles = require('../partitioner/sql/roles');

var System = function (manager) {
  this._manager = manager;
  this._manager._partitioner._dbName = System.DB_NAME;
};

System.DEFAULT_ADMIN_USER_UUID = '$admin';
System.DEFAULT_ADMIN_ROLE = '$admin';
System.DEFAULT_ADMIN_USER = 'admin';
System.DEFAULT_ADMIN_PWD = 'admin';

System.DB_NAME = clientUtils.SYSTEM_DB_NAME;

System.DB_COLLECTION_NAME = clientUtils.DB_COLLECTION_NAME;
System.DB_ATTR_NAME = clientUtils.DB_ATTR_NAME;
System.ATTR_NAME_ACTION = clientUtils.ATTR_NAME_ACTION;

System.DOC_ID_DB_COLLECTION = System.DB_COLLECTION_NAME;

System.prototype._queueCreateDefaultAdminUser = function () {
  return this._manager.genUserAndQueueCreateUser(System.DEFAULT_ADMIN_USER_UUID,
    System.DEFAULT_ADMIN_USER, System.DEFAULT_ADMIN_PWD,
    Users.STATUS_ENABLED, System.DEFAULT_ADMIN_USER_UUID);
};

System.prototype._queueCreateDatabasesCollection = function () {
  // Queue collection creation so that there is an audit trail
  // Create a collection for the databases and populate with a reference to $system
  var changes = [{
    col: System.DB_COLLECTION_NAME,
    id: System.DOC_ID_DB_COLLECTION,
    name: 'name',
    uid: System.DEFAULT_ADMIN_USER_UUID, // default policy so that only this user can edit
    val: JSON.stringify(System.DB_NAME),
    up: (new Date()).toISOString()
  }];
  return this._manager._partitioner.queue(changes, true);
};

// TODO: is this even needed? Isn't the default policy that only $admin can edit?
System.prototype._queueAdminPolicy = function () {
  var policy = {
    col: {
      create: System.DEFAULT_ADMIN_ROLE,
      read: System.DEFAULT_ADMIN_ROLE,
      update: System.DEFAULT_ADMIN_ROLE,
      destroy: System.DEFAULT_ADMIN_ROLE
    }
  };
  return this._manager.queueSetPolicy(policy, Cols.ALL, null, System.DEFAULT_ADMIN_USER_UUID);
};

// Allow anyone to create or destroy DBs
System.prototype._queueAdminPartyDBPolicy = function () {
  var policy = {
    col: {
      create: Roles.ALL,
      read: Roles.ALL,
      update: Roles.ALL,
      destroy: Roles.ALL
    }
  };
  return this._manager.queueSetPolicy(policy, clientUtils.DB_COLLECTION_NAME, null,
    System.DEFAULT_ADMIN_USER_UUID);
};

// Allow anyone to create or destroy any col
System.prototype._queueAdminPartyAllColsPolicy = function () {
  var policy = {
    col: {
      create: Roles.ALL,
      read: Roles.ALL,
      update: Roles.ALL,
      destroy: Roles.ALL
    }
  };
  return this._manager.queueSetPolicy(policy, clientUtils.COL_NAME_ALL, null,
    System.DEFAULT_ADMIN_USER_UUID);
};

// All users can CRUD
System.prototype._queueAdminPartyPolicy = function () {
  var self = this;
  return self._queueAdminPartyAllColsPolicy().then(function () {
    return self._queueAdminPartyDBPolicy();
  });
};

System.prototype.create = function (adminParty) {
  var self = this;
  return self._manager._partitioner.createDatabase().then(function () {
    return self._queueCreateDefaultAdminUser();
  }).then(function () {
    return self._manager._partitioner.process(); // actually create user & role
  }).then(function () {
    return self._queueCreateDatabasesCollection();
  }).then(function () {
    return self._queueAdminPolicy(); // losen policy so any admin can create database
  }).then(function () {
    if (adminParty) {
      return self._queueAdminPartyPolicy();
    }
  }).then(function () {
    return self._manager._partitioner.process();
  });
};

System.prototype.destroy = function () {
  return this._manager._partitioner.destroyDatabase();
};

module.exports = System;
