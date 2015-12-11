'use strict';

var Doc = require('deltadb/scripts/doc'),
  Users = require('../partitioner/sql/user/users'),
  Cols = require('../partitioner/sql/col/cols'),
  UserRoles = require('../partitioner/sql/user/user-roles'),
  clientUtils = require('deltadb/scripts/utils'),
  commonUtils = require('deltadb-common-utils');

var Manager = function (partitioner) {
  this._partitioner = partitioner;
};

Manager.prototype.genUser = function () {
  return clientUtils.genUser.apply(clientUtils, arguments);
};

// TODO: remove docUUID param as derived from userUUID
Manager.prototype.queueCreateUser = function (docUUID, user, changedByUUID) {
  // docUUID is used so that we can update user later. docUUID is derived from userUUID as we need
  // to create user's dynamically when we first encounter a change and need a way to reference that
  // user later
  docUUID = Users.toDocUUID(user.uuid);
  changedByUUID = commonUtils.notDefined(changedByUUID) ? user.uuid : changedByUUID;
  var changes = [{
    col: Doc._userName,
    id: docUUID,
    name: Doc._userName,
    val: JSON.stringify(user),
    up: (new Date()).toISOString(),
    uid: changedByUUID
  }];
  return this._partitioner.queue(changes, true);
};

Manager.prototype.genUserAndQueueCreateUser = function (userUUID, username, password,
  status, changedByUUID) {
  var self = this;
  var docUUID = null; // TODO: remove after remove from queueCreateUser
  return self.genUser(userUUID, username, password, status).then(function (user) {
    return self.queueCreateUser(docUUID, user, changedByUUID);
  });
};

Manager.prototype.queueUpdateUser = function (docUUID, user, changedByUUID) {
  return this.queueCreateUser(docUUID, user, changedByUUID);
};

Manager.prototype.queueAddRole = function (userUUID, roleName, changedByUUID) {
  // Create a user role by adding a doc to the user's collection
  var col = Cols.NAME_PRE_USER_ROLES + userUUID;
  changedByUUID = commonUtils.notDefined(changedByUUID) ? userUUID : changedByUUID;
  // Note: we store the userUUID and roleName in the val so that the user and role modifications are
  // consistent and so that the userUUID can be retrieved for the role modifications and the
  // roleName can be retrieve for the user modifications.
  var changes = [{
    col: col,
    name: Doc._roleName,
    val: JSON.stringify({
      action: UserRoles.ACTION_ADD,
      userUUID: userUUID,
      roleName: roleName
    }),
    uid: changedByUUID,
    up: (new Date()).toISOString()
  }];
  return this._partitioner.queue(changes, true);
};

Manager.prototype.queueRemoveRole = function (userUUID, roleName, changedByUUID) {
  // Each user needs their own roles collection so that roles can be added or removed independently
  var col = Cols.NAME_PRE_USER_ROLES + userUUID;
  changedByUUID = commonUtils.notDefined(changedByUUID) ? userUUID : changedByUUID;
  // Note: we store the userUUID and roleName in the val so that the user and role modifications are
  // consistent and so that the userUUID can be retrieved for the role modifications and the
  // roleName can be retrieve for the user modifications.
  var changes = [{
    col: col,
    name: Doc._roleName,
    val: JSON.stringify({
      action: UserRoles.ACTION_REMOVE,
      userUUID: userUUID,
      roleName: roleName
    }),
    uid: changedByUUID,
    up: (new Date()).toISOString()
  }];
  return this._partitioner.queue(changes, true);
};

Manager.prototype.queueSetPolicy = function (policy, col, id, userUUID) {
  var changes = [{
    col: col,
    id: id ? id : commonUtils.uuid(),
    name: Doc._policyName,
    val: JSON.stringify(policy),
    up: (new Date()).toISOString(),
    uid: userUUID
  }];
  return this._partitioner.queue(changes, true);
};

Manager.prototype._queueDatabaseAction = function (dbName, userUUID, action) {
  // We don't specify an id as we want the client to destroy the db without having to have the id
  // that was used when the db was created
  var changes = [{
    id: commonUtils.uuid(), // generate uuid
    col: clientUtils.DB_COLLECTION_NAME,
    name: clientUtils.ATTR_NAME_ACTION,
    val: JSON.stringify({
      action: action,
      name: dbName
    }),
    up: (new Date()).toISOString(),
    uid: userUUID
  }];
  return this._partitioner.queue(changes, true);
};

Manager.prototype.queueCreateDatabase = function (dbName, userUUID) {
  return this._queueDatabaseAction(dbName, userUUID, clientUtils.ACTION_ADD);
};

Manager.prototype.queueDestroyDatabase = function (dbName, userUUID) {
  return this._queueDatabaseAction(dbName, userUUID, clientUtils.ACTION_REMOVE);
};

module.exports = Manager;
