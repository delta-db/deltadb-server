'use strict';

var Promise = require('bluebird'),
  ForbiddenError = require('../forbidden-error'),
  constants = require('../constants'),
  AttrRec = require('./attr-rec'),
  AttrParams = require('./attr-params'),
  UserRoles = require('../user/user-roles');

var Doc = require('../../../client/doc');

var Attr = function (sql, partitionName, policy, partitions, users, docs, params, roles,
  partitioner) {
  this._sql = sql;
  this._partitionName = partitionName;
  this._policy = policy;
  this._partitions = partitions;
  this._users = users;
  this._params = params ? params : new AttrParams();
  this._docs = docs;
  this._roles = roles;
  this._partitioner = partitioner;
};

Attr.prototype.create = function () {
  var self = this,
    up = null,
    latestNoDelRestore = null;

  // Don't replace LATEST unless there is a quorum
  if (self._partitionName === constants.LATEST && !self._params.quorum) {
    return Promise.resolve(false);
  }

  return self.createIfPermitted().then(function () {
    return self.setDestroyedOrUpdateDoc();
  }).then(function (updated) {
    up = updated; // attr was updated? (non-del update)

    // Prevent infinite recursion by checking restore flag. Not restoring, for LATEST and not del?
    latestNoDelRestore = !self._params.restore && self._partitionName === constants.LATEST &&
      self._params.name;

    if (latestNoDelRestore) {
      return self.restoreIfDestroyedBefore();
    }
  }).then(function () {
    if (latestNoDelRestore && up) {
      return self.setOptions();
    }
  });
};

Attr.prototype.permitted = function (action) {
  var rbui = this._params.recordedByUserId; // long tiernary causes problem w/ js-beautify
  var permUserId = rbui ? rbui : this._params.changedByUserId;
  return this._policy.permitted(permUserId, action, this._params.colId,
    this._params.docUUID, this._params.name);
};

Attr.prototype.newAttrRec = function (partitionName) {
  return new AttrRec(this._sql, partitionName, this._params, this._partitioner);
};

Attr.prototype.createIfPermitted = function () {
  var self = this;
  var action = self._params.value ? constants.ACTION_UPDATE : constants.ACTION_DESTROY;
  var attrRec = self.newAttrRec(self._partitionName);
  return self.permitted(action).then(function (allowed) {
    if (!allowed) {
      throw new ForbiddenError(action + ' forbidden');
    }
    return attrRec.createOrReplace();
  });
};

// Attr.prototype.setOptions = function () {
//   // TODO: do we really need both this._params.changedByUUID & this._params.userUUID??
//   if (this._params.name === Doc._policyName) {
//     return this._policy.setPolicy(this._params.docId, this._params.name, this._params.value,
//       this._params.changedByUserId, this._params.recordedAt,
//       this._params.updatedAt, this._params.seq,
//       this._params.restore, this._params.quorum,
//       this._params.colId, this._params.userUUID);
//   } else if (this._params.name === Doc._userName) {
//     return this._users.setUser(this._params.value, this._params.updatedAt,
//       this._params.changedByUserId, this._params.changedByUUID);
//   } else if (this._params.name === Doc._roleName) {
//     var roleUUID = this._roles.toUUID(this._params.value.roleName);
//     if (this._params.value.action === UserRoles.ACTION_REMOVE) {
//       return this._users.removeRole(this._params.forUserId, roleUUID);
//     } else {
//       return this._users.addRole(this._params.forUserId, roleUUID,
//         this._params.changedByUserId, this._params.changedByUUID,
//         this._params.updatedAt, this._params.docId);
//     }
//   } else {
//     return Promise.resolve();
//   }
// };

Attr.prototype.setOptions = function () {
  // TODO: do we really need both this._params.changedByUUID & this._params.userUUID??

  switch (this._params.name) {

    case Doc._policyName:
      return this._policy.setPolicy(this._params.docId, this._params.name, this._params.value,
        this._params.changedByUserId, this._params.recordedAt,
        this._params.updatedAt, this._params.seq,
        this._params.restore, this._params.quorum,
        this._params.colId, this._params.userUUID);
    
    case Doc._userName:
      return this._users.setUser(this._params.value, this._params.updatedAt,
        this._params.changedByUserId, this._params.changedByUUID);

    case Doc._roleName:
      var roleUUID = this._roles.toUUID(this._params.value.roleName);
      if (this._params.value.action === UserRoles.ACTION_REMOVE) {
        return this._users.removeRole(this._params.forUserId, roleUUID);
      } else {
        return this._users.addRole(this._params.forUserId, roleUUID,
          this._params.changedByUserId, this._params.changedByUUID,
          this._params.updatedAt, this._params.docId);
      }

    default:
      return Promise.resolve();
  }
};

Attr.prototype.destroyingDoc = function () {
  return !this._params.name && !this._params.value;
};

// Resolves as true if doc is updated and not destroyed
Attr.prototype.setDestroyedOrUpdateDoc = function () {
  var self = this;
  if (self.destroyingDoc()) {
    return self._docs.destroy(self._partitionName, self._params.docId, self._params.changedByUserId,
      self._params.updatedAt, self._params.restore, self._params.docUUID,
      self._params.colId, self._params.userUUID);
  } else {
    // TODO: remove new Date()
    var updatedAt = new Date(self._params.updatedAt ? self._params.updatedAt : null);
    return self._partitions[self._partitionName]._docs.update(self._params.docId, updatedAt)
      .then(function (results) {
        return results && results.affected > 0;
      });
  }
};

Attr.prototype.restoreIfDestroyedBefore = function () {
  // Note: we have to use the last_destroyed_at as the destroyed_at is set to null when the doc has
  // been updated and a race condition could otherwise lead to a deletion happening just after we
  // check destroyed_at
  var self = this;
  return self._partitions[constants.LATEST]._docs.lastDestroyedAt(self._params.docId)
    .then(function (destroyedAt) {
      if (destroyedAt && destroyedAt.getTime() < self._params.updatedAt.getTime()) {
        return self._docs._restore(self._params.docId, {
          changedByUserId: self._params.changedByUserId,
          updatedAt: self._params.updatedAt,
          docUUID: self._params.docUUID,
          colId: self._params.colId,
          userUUID: self._params.userUUID
        });
      }
    });
};

Attr.prototype.createLatestAndAllAndRecentAndRecentAttr = function () {
  var self = this;
  return self.create().then(function () {
    self._partitionName = constants.ALL;
    return self.create();
  }).then(function () {
    self._partitionName = constants.RECENT;
    return self.create();
  }).catch(function (err) {
    if (!(err instanceof ForbiddenError)) {
      throw err;
    }
  });
};

module.exports = Attr;