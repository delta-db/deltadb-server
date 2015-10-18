'use strict';

var Promise = require('bluebird'),
  ForbiddenError = require('../forbidden-error'),
  constants = require('../constants'),
  AttrRec = require('./attr-rec'),
  AttrParams = require('./attr-params'),
  UserRoles = require('../user/user-roles'),
  System = require('../../../system'),
  log = require('../../../server/log'),
  Docs = require('../doc/docs'),
  DBMissingError = require('../../../client/db-missing-error'),
  DBExistsError = require('../../../client/db-exists-error');

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

Attr.prototype._canDestroyOrUpdateDoc = function () {
  var self = this;
  if (self.destroyingDoc()) {
    // TODO: all params needed?
    return self._docs.canDestroy(self._partitionName, self._params.docId,
      self._params.changedByUserId, self._params.updatedAt, self._params.restore,
      self._params.docUUID, self._params.colId, self._params.userUUID);
  } else {
    // TODO: remove new Date()
    var updatedAt = new Date(self._params.updatedAt);
    return self._partitions[self._partitionName]._docs.canUpdate(self._params.docId, updatedAt);
  }
};

Attr.prototype._processCreateErr = function (err) {
  // We can expect a DBExistsError/DBMissingError if two clients try to create/destroy the same DB
  // simultaneously
  if (err instanceof ForbiddenError || err instanceof DBExistsError ||
    err instanceof DBMissingError) {
    log.warning('Cannot create attr, err=' + err.message + ', stack=' + err.stack);
  } else {
    throw err;
  }
};

// TODO: split up
Attr.prototype.create = function () {
  // We want to make sure that we set the options before we create the attr as creating the attr
  // will alert the calling process and we want this alert to be done after the options are set,
  // e.g. alert after the DB has been created.
  //
  // 1. Check permissions
  // 2. Can we destroy or update the doc based on timestamp? (need to gurantee that we haven't
  //    processed an earlier change)
  // 3. Set options, e.g. create a DB
  // 4. Create the attr
  // 5. Auto restore if the attr was previously deleted

  var self = this,
    latestNoRestore = null,
    latestNoDelRestore = null;

  // Don't replace LATEST unless there is a quorum
  if (self._partitionName === constants.LATEST && !self._params.quorum) {
    return Promise.resolve(false);
  }

  latestNoRestore = !self._params.restore && self._partitionName === constants.LATEST;

  // Prevent infinite recursion by checking restore flag. Not restoring, for LATEST and not del?
  latestNoDelRestore = latestNoRestore && self._params.name;

  return self._canCreate().then(function () {
    return self._canDestroyOrUpdateDoc();
  }).then(function (canUpdate) {
    if (latestNoRestore && canUpdate) {
      // Only set the options if the doc was updated. We want to prevent back-to-back changes from
      // creating issues, e.g. if create DB and destroy DB requests are made back-to-back there is
      // no guarantee of which order they will be received. This means that if we receive the
      // destroy DB first then we'll destroy and then create. Instead, we'll ignore any deltas for
      // docs for which we have already received a later update, e.g. we'd process the destroy and
      // ignore the create.
      return self.setOptions();
    }
  }).then(function () {
    return self.createIfPermitted();
  }).then(function () {
    return self.setDestroyedOrUpdateDoc();
  }).then(function ( /* updated */ ) {
    if (latestNoDelRestore) {
      return self.restoreIfDestroyedBefore();
    }
  }).catch(function (err) {
    self._processCreateErr(err);
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

Attr.prototype._canCreate = function () {
  var self = this;
  var action = self._params.value ? constants.ACTION_UPDATE : constants.ACTION_DESTROY;
  return self.permitted(action).then(function (allowed) {
    if (!allowed) {
      throw new ForbiddenError(action + ' forbidden');
    }
  });
};

Attr.prototype.createIfPermitted = function () {
  var self = this;
  var attrRec = self.newAttrRec(self._partitionName);
  return self._canCreate().then(function () {
    return attrRec.createOrReplace();
  });
};

Attr.prototype._destroyDB = function () {
  return this._partitioner.destroyAnotherDatabase(this._params.value.name).catch(function (err) {
    // Ignore DBMissingErrors caused by race conditions when destroying the database
    if (!(err instanceof DBMissingError)) {
      throw err;
    }
  });
};

Attr.prototype._createDB = function () {
  return this._partitioner.createAnotherDatabase(this._params.value.name).catch(function (err) {
    // Ignore DBMissingErrors caused by race conditions when creating the database
    if (!(err instanceof DBExistsError)) {
      throw err;
    }
  });
};

Attr.prototype._createOrDestroyDatabase = function () {
  // Only create DB if this the system partitioner
  if (this._partitioner._dbName !== System.DB_NAME) {
    // TODO: log?
    return Promise.resolve();
  }

  if (this._params.value.action === AttrRec.ACTION_REMOVE) {
    return this._destroyDB();
  } else {
    return this._createDB();
  }
};

Attr.prototype.setOptions = function () {
  // TODO: do we really need both this._params.changedByUUID & this._params.userUUID??

  switch (this._params.name) {

  case Doc._policyName:
    // TODO: create fn for following
    return this._policy.setPolicy(this._params.docId, this._params.name, this._params.value,
      this._params.changedByUserId, this._params.recordedAt,
      this._params.updatedAt, this._params.seq,
      this._params.restore, this._params.quorum,
      this._params.colId, this._params.userUUID);

  case Doc._userName:
    // TODO: create fn for following
    return this._users.setUser(this._params.value, this._params.updatedAt,
      this._params.changedByUserId, this._params.changedByUUID);

  case Doc._roleName: // TODO: split into fns
    var roleUUID = this._roles.toUUID(this._params.value.roleName);
    var ret = null;
    if (this._params.value.action === UserRoles.ACTION_REMOVE) {
      ret = this._users.removeRole(this._params.forUserId, roleUUID);
    } else {
      ret = this._users.addRole(this._params.forUserId, roleUUID,
        this._params.changedByUserId, this._params.changedByUUID,
        this._params.updatedAt, this._params.docId);
    }
    return ret;

  case System.DB_ATTR_NAME:
    return this._createOrDestroyDatabase();

  default:
    return Promise.resolve();
  }
};

Attr.prototype.destroyingDoc = function () {
  // TODO: similar code exists in process, attr-rec and here => re-use??
  var name = this._params.name,
    value = this._params.value;
  if (Docs.isIdLess(this._params.name)) { // an id-less change?
    if (this._params.value.action === AttrRec.ACTION_ADD) {
      value = this._params.value.action.name;
    } else { // remove doc
      name = null;
      value = null;
    }
  }
  return !name && !value;
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
  });
};

module.exports = Attr;