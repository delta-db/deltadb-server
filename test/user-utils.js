'use strict';

var testUtils = require('./utils'),
  Manager = require('../scripts/manager'),
  Cols = require('../scripts/partitioner/sql/col/cols');

var Utils = function (args) {
  // Need to store DB wrapper as DB instance may not be ready yet
  this._args = args;
};

// The following doc UUIDs are defined for testing purposes so that we can reliabily determine the
// contents of the DB
Utils.prototype.POLICY_ID = 'policy';
Utils.prototype.USER_ID = 'user';

Utils.prototype.userUUID = 'user-uuid'; // test userUUID

Utils.prototype.ROLE = 'role'; // shorthand, e.g. w/o prefix

Utils.prototype._mgr = function () {
  // TODO: look into why callers need to instantiate Manager each time?
  return new Manager(this._args.db);
};

Utils.prototype.createUser = function (userUUID, username, password, status, changedByUUID) {
  var mgr = this._mgr();
  return mgr.genUser(userUUID, username, password, status).then(function (user) {
    return mgr.queueCreateUser(userUUID, user, changedByUUID);
  }).then(function () {
    return mgr._partitioner.process();
  });
};

Utils.prototype.updateUser = function (userUUID, username, password, status, changedByUUID) {
  return this.createUser(userUUID, username, password, status, changedByUUID);
};

Utils.prototype.addUserRole = function (userUUID, roleName, changedByUUID) {
  var mgr = this._mgr();
  return mgr.queueAddRole(userUUID, roleName, changedByUUID).then(function () {
    return mgr._partitioner.process();
  });
};

Utils.prototype.removeUserRole = function (userUUID, roleName, changedByUUID) {
  var mgr = this._mgr();
  return mgr.queueRemoveRole(userUUID, roleName, changedByUUID).then(function () {
    return mgr._partitioner.process();
  });
};

Utils.prototype.allPolicy = {
  col: {
    create: '$all',
    read: '$all',
    update: '$all',
    destroy: '$all'
  }
};

Utils.prototype.setPolicy = function (policy, col, id, userUUID) {
  if (policy) {
    var mgr = this._mgr();
    return mgr.queueSetPolicy(policy, col ? col : 'task', id ? id : this.POLICY_ID, userUUID)
      .then(function () {
        return mgr._partitioner.process();
      });
  } else {
    // Use dummy changes if policy is null so that we can reuse our tests by occupying doc_id=1
    var changes = [{
      col: col ? col : 'task',
      id: id ? id : this.POLICY_ID,
      name: 'policy',
      val: null,
      up: (new Date()).toISOString(),
      uid: userUUID
    }];
    return testUtils.queueAndProcess(this._args.db, changes, true);
  }
};

Utils.prototype.allowAll = function (col, id, userUUID) {
  return this.setPolicy(this.allPolicy, col, id, userUUID); // all can CRUD
};

Utils.prototype.allowAllForAllCols = function () {
  return this.allowAll(Cols.ALL, Cols.ID_ALL, '$admin');
};

Utils.prototype.roleIds = null;

Utils.prototype.getRoleIds = function () {
  var roleIds = {},
    self = this;
  return self._args.db._sql.find(null, 'roles', null, null, ['id', 'asc']).then(function (results) {
    results.rows.forEach(function (row) {
      roleIds[self._args.db._roles.toName(row.uuid)] = row.id;
    });
    self.roleIds = roleIds;
    return roleIds;
  });
};

Utils.prototype.createDatabase = function (dbName, userUUID) {
  var mgr = this._mgr();
  return mgr.queueCreateDatabase(dbName, userUUID).then(function () {
    return mgr._partitioner.process();
  });
};

Utils.prototype.destroyDatabase = function (dbName, userUUID) {
  var mgr = this._mgr();
  return mgr.queueDestroyDatabase(dbName, userUUID).then(function () {
    return mgr._partitioner.process();
  });
};

module.exports = Utils;
