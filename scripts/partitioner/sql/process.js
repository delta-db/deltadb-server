'use strict';

// To utilize multiple cores on the DB server we should not assume that any change will be queued or
// processed before another as different threads could queue or process batches of changes in a
// random order. Instead, the client needs to transmit all users (if any), then policies (if any)
// and then other changes and block in between each step. This will prevent changes from being
// prohibited due to timing issues or missing users or policies. When servers sync with each other
// they should have $super user permissions so that they can sync all changes, as defined by their
// policy, regardless of the state of the underlying user privledges. The server sync however, needs
// to automatically create users which don't exist as changes can be received in any order and a
// userId is needed when saving changes.

// TODO: split into models process-users, process-user-roles, process-cols, process-docs

var Promise = require('bluebird'),
  constants = require('./constants'),
  Attr = require('./attr/attr'),
  utils = require('../../utils'),
  ForbiddenError = require('./forbidden-error'),
  AttrParams = require('./attr/attr-params'),
  QueueAttrRec = require('./queue/queue-attr-rec'),
  Cols = require('./col/cols'),
  Users = require('./user/users'),
  Doc = require('../../client/doc'),
  UserRoles = require('./user/user-roles'),
  Docs = require('./doc/docs'),
  clientUtils = require('../../client/utils'),
  log = require('../../server/log');

// TODO: remove unneeded params
var Process = function (sql, docs, users, queueAttrRecs, partitions, cols, policy, roles,
  userRoles, attrs, partitioner) {
  this._sql = sql;
  this._docs = docs;
  this._users = users;
  this._queueAttrRecs = queueAttrRecs;
  this._partitions = partitions;
  this._cols = cols;
  this._policy = policy;
  this._roles = roles;
  this._userRoles = userRoles;
  this._mainParts = [constants.LATEST, constants.RECENT, constants.ALL];
  this._clearCache();
  this._attrs = attrs;
  this._partitioner = partitioner;
};

Process.prototype._clearCache = function () {
  var self = this;
  this._deltas = [];
  this._userIds = {};
  this._userIdsToCreate = []; // need an array as order matters as need to create creator first
  this._colIds = {};
  this._docIds = {};
  this._roleIds = {};
  this._mainParts.forEach(function (part) {
    self._docIds[part] = {};
  });
};

Process.prototype._createUser = function (userUUID, updatedAt, changedByUUID, superUUID) {
  var self = this;
  var changedByUserId = self._userIds[changedByUUID];
  var recordedByUUID = superUUID ? superUUID : changedByUUID;
  var recordedByUserId = self._userIds[recordedByUUID];
  var docUUID = Users.toDocUUID(userUUID);
  return self._docs._canCreate(Cols.ID_USER, docUUID, recordedByUserId).then(function (allowed) {
    if (allowed) {
      // Use getOrCreateUserId as race condition could have just created col and getOrCreateColId
      // also creates default policies
      return self._users.getOrCreateUserId(userUUID, updatedAt, changedByUserId,
        changedByUUID);
    } else {
      // TODO: throw error higher in stack so that the handling is cleaner
      log.error('No permission to create ' + userUUID);
    }
  });
};

Process.prototype._getOrCreateUser = function (userUUID, updatedAt, changedByUUID, superUUID) {
  var self = this;
  // Don't need permission to lookup user
  return self._users.getUserId(userUUID).then(function (userId) {
    if (userId) {
      self._userIds[userUUID] = userId;
    }
    return self._createUser(userUUID, updatedAt, changedByUUID, superUUID).then(function (
      userId) {
      self._userIds[userUUID] = userId;
    });
  });
};

// -----

Process.prototype._forUserUUID = function (attr) {
  if (attr.attr_name === Doc._userName) { // creating a user?
    var user = JSON.parse(attr.attr_val);
    return user.uuid;
  } else if (attr.attr_name === Doc._roleName) { // adding user to role?
    return this._roles.toUserUUID(attr.col_name);
  }
};

Process.prototype._fromDeltaValue = function (value) {
  // Null values are treated as undefined
  return value ? JSON.parse(value) : undefined;
};

Process.prototype._createOrUpdateAttr = function (part, attr) {
  // We need to check to see if the userId, colId and docId exists as it may not have been created
  // due to a lack of permission

  if (((attr.user_uuid && this._userIds[attr.user_uuid]) || !attr.user_uuid) && this._colIds[attr
      .col_name] && this._docIds[part][attr.doc_uuid]) {

    // TODO: removing destroyed_at at attr-rec layer, right??
    // TODO: is the following still needed? If so, move to DocRecs?
    var destroyedAt = null;
    if (!attr.attr_name && !attr.attr_val) { // del doc?
      destroyedAt = attr.updated_at;
    }
    var updatedAt = attr.updated_at;

    var forUserUUID = this._forUserUUID(attr);

    var recordedByUserId = this._getRecordedByUserId(attr);

    var val = this._fromDeltaValue(attr.attr_val);

    var params = new AttrParams(this._docIds[part][attr.doc_uuid], attr.attr_name,
      val, this._userIds[attr.user_uuid],
      destroyedAt, attr.recorded_at, updatedAt, attr.seq, attr.quorum,
      attr.user_uuid, this._colIds[attr.col_name], attr.doc_uuid,
      this._userIds[forUserUUID], forUserUUID, recordedByUserId);

    var at = new Attr(this._sql, part, this._policy, this._partitions, this._users,
      this._docs, params, this._roles, this._partitioner);
    return at.create();

  }
};

Process.prototype._createOrUpdateAttrs = function (attr) {
  var self = this,
    promises = [];
  self._mainParts.forEach(function (part) {
    promises.push(self._createOrUpdateAttr(part, attr));
  });
  return Promise.all(promises);
};

Process.prototype._destroyQueueAttrRec = function (attr) {
  var queueAttrRec = new QueueAttrRec(this._sql, attr.id);
  return queueAttrRec.destroy();
};

Process.prototype._cacheSuperUser = function (attr) {
  if (attr.super_uuid && utils.notDefined(this._userIds[attr.super_uuid])) {
    return this._getOrCreateUser(attr.super_uuid, attr.updated_at, attr.super_uuid,
      attr.super_uuid);
  } else {
    return Promise.resolve();
  }
};

Process.prototype._cacheCreatingUser = function (attr) {
  if (attr.user_uuid && utils.notDefined(this._userIds[attr.user_uuid])) {
    return this._getOrCreateUser(attr.user_uuid, attr.updated_at, attr.user_uuid, attr.super_uuid);
  } else {
    return Promise.resolve();
  }
};

Process.prototype._cacheForUser = function (attr) {
  var userUUID = this._forUserUUID(attr);
  if (userUUID && userUUID !== attr.user_uuid && utils.notDefined(this._userIds[userUUID])) {
    return this._getOrCreateUser(userUUID, attr.updated_at, attr.user_uuid);
  } else {
    return Promise.resolve();
  }
};

Process.prototype._cacheUsersForAttr = function (attr) {
  var self = this;
  return self._cacheSuperUser(attr).then(function () {
    return self._cacheCreatingUser(attr);
  }).then(function () {
    return self._cacheForUser(attr);
  });
};

Process.prototype._cacheUsers = function (attrs) {
  // Chain sequentially so that we don't end up looking up the same users simulatenously
  var self = this,
    promise = Promise.resolve();
  attrs.forEach(function (attr) {
    promise = promise.then(function () {
      return self._cacheUsersForAttr(attr);
    });
  });
  return promise;
};

// -----

Process.prototype._cacheRoleIds = function (attr) {
  // Note: we only need to get roleIds and not create them as we use them to look up the docUUID and
  // only if the role already exists
  var self = this;
  if (attr.attr_name === Doc._roleName) { // modifying user role?

    var action = JSON.parse(attr.attr_val);
    var roleUUID = self._roles.toUUID(action.roleName);

    if (!self._roleIds[roleUUID]) { // missing?
      return self._roles.getRoleId(roleUUID).then(function (roleId) {
        self._roleIds[roleUUID] = roleId;
      });
    }

  }
  return Promise.resolve();
};

// -----

// TODO: remove once this type of logic is handled by Cols
Process.prototype._canCreateCol = function (colName, userId) {
  var self = this;
  return self._cols._canCreate(colName, userId).then(function (allowed) {
    if (!allowed) {
      throw new ForbiddenError('cannot create col ' + colName);
    }
  });
};

Process.prototype._canCreateUserRoleCols = function (userColName, roleColName, changedByUserId) {
  var self = this;
  return self._canCreateCol(userColName, changedByUserId).then(function () { // col for user?
    return self._canCreateCol(roleColName, changedByUserId); // col for role?
  });
};

Process.prototype._lookupOrCreateUserRoleCols = function (userColName, roleColName, forUserUUID,
  attr, recordedByUserId) {
  var self = this,
    userColId = null;
  return self._getOrCreateCol( // user col
      {
        colName: userColName,
        userUUID: attr.user_uuid,
        updatedAt: attr.updated_at,
        recordedByUserId: recordedByUserId
      })
    .then(function (_userColId) {
      userColId = _userColId;
      return self._getOrCreateCol( // role col
        {
          colName: roleColName,
          userUUID: attr.user_uuid,
          updatedAt: attr.updated_at,
          recordedByUserId: recordedByUserId
        });
    }).then(function (roleColId) {
      return {
        userColId: userColId,
        roleColId: roleColId
      };
    });
};

Process.prototype._lookupOrCreateUserRoleColsIfPermitted = function (userColName, roleColName,
  changedByUserId, forUserUUID,
  attr, recordedByUserId) {
  // Note: the recordedByUserId could be a super user so we need to check permissions with the
  // recordedByUserId and then use the changedByUserId when saving the delta.
  var self = this,
    permUserId = recordedByUserId ? recordedByUserId : changedByUserId;
  return self._canCreateUserRoleCols(userColName, roleColName, permUserId).then(function () {
    return self._lookupOrCreateUserRoleCols(userColName, roleColName, forUserUUID, attr,
      recordedByUserId);
  });
};

Process.prototype._createCol = function (colName, userId, userUUID, updatedAt, recordedByUserId) {
  var self = this,
    permUserId = recordedByUserId ? recordedByUserId : userId;
  return self._cols.getOrCreateIfPermitted(colName, userId, userUUID, updatedAt, permUserId)
    .then(function (colId) {
      self._colIds[colName] = colId;
      return colId;
    });
};

Process.prototype._getOrCreateCol = function (col) {
  var self = this;
  self._colIds[col.colName] = null; // set to null, in case of error
  if (!col.userUUID || self._userIds[col.userUUID]) { // user cached?
    return self._cols.getColId(col.colName).then(function (colId) {
      self._colIds[col.colName] = colId; // is null if not found
      if (!colId) { // found?
        return self._createCol(col.colName, self._userIds[col.userUUID], col.userUUID,
          col.updatedAt, col.recordedByUserId);
      }
    }).catch(function (err) {
      if (err instanceof ForbiddenError) {
        log.error('Error getting or creating col ' + col.colName + ', err=' + err.message);
      } else {
        throw err;
      }
    });
  } else { // e.g. if was no perm to create user
    return Promise.resolve();
  }
};

Process.prototype._lookupOrCreateCols = function () {
  var self = this,
    promises = [];
  // We don't need to sequentially chain as all the colIds have already been added sequentially
  utils.each(self._colIds, function (attr) {
    promises.push(self._getOrCreateCol(attr));
  });
  return Promise.all(promises);
};

// -----

Process.prototype._createDoc = function (partition, docUUID, colId, userId,
  recordedAt, updatedAt, attrName, attrVal, colName, recordedByUserId) {
  var self = this;

  // Note: only checks LATEST for permission
  var permUserId = recordedByUserId ? recordedByUserId : userId;
  return self._canCreateDoc(colId, docUUID, permUserId, attrName, attrVal, colName)
    .then(function () {

      // TODO: move to DocRecs?
      var destroyedAt = null;
      if (!attrName && !attrVal) { // del doc?
        destroyedAt = updatedAt;
        updatedAt = null;
      }

      // Use getOrCreateColId as race condition could have just created doc. Ignore permission check
      // when calling getOrCreate() as checked permissions above
      var force = true;
      return self._partitions[partition]._docs.getOrCreate(docUUID, colId, userId, destroyedAt,
          recordedAt, updatedAt, attrName, attrVal,
          force)
        .then(function (docId) {
          self._docIds[partition][docUUID] = docId;
        });
    });
};

Process.prototype._getOrCreateDoc = function (partition, doc) {

  // Note: even if the docId wasn't found before, we still need to do another lookup as it may have
  // been created or the permissions may have changed since
  var self = this;
  self._docIds[partition][doc.docUUID] = null; // set to null, in case of error

  // user & col cached?
  if ((!doc.userUUID || self._userIds[doc.userUUID]) && self._colIds[doc.colName]) {
    return self._partitions[partition]._docs.getId(doc.docUUID).then(function (docId) {
      self._docIds[partition][doc.docUUID] = docId; // is null if not found
      if (!docId) { // found?
        return self._createDoc(partition, doc.docUUID, self._colIds[doc.colName],
          self._userIds[doc.userUUID], doc.recordedAt, doc.updatedAt,
          doc.attrName, doc.attrVal, doc.colName, doc.recordedByUserId);
      }
    }).catch(function (err) {
      if (err instanceof ForbiddenError) {
        log.error('Error getting or creating doc, err=' + err.message);
      } else {
        throw err;
      }
    });
  } else { // e.g. if no perm to create user or doc
    return Promise.resolve();
  }
};

Process.prototype._getOrCreateDocs = function (attr) {
  var self = this,
    promises = [];
  self._mainParts.forEach(function (part) {
    promises.push(self._getOrCreateDoc(part, attr));
  });
  return Promise.all(promises);
};

Process.prototype._lookupOrCreateDocs = function () {
  var self = this,
    promises = [];
  // We don't need to sequentially chain as all the colIds have already been added sequentially
  utils.each(self._docIds[constants.ALL], function (attr) {
    promises.push(self._getOrCreateDocs(attr));
  });
  return Promise.all(promises);
};

// TODO: remove once this type of logic is handled by DocRecs
Process.prototype._canCreateDoc = function (colId, docUUID, userId) {
  var self = this;
  return self._docs._canCreate(colId, docUUID, userId).then(function (allowed) {
    if (!allowed) {
      throw new ForbiddenError('cannot create doc ' + docUUID);
    }
  });
};

Process.prototype._canCreateUserRoleDocs = function (userColId, roleColId, userDocUUID,
  roleDocUUID, changedByUserId, recordedByUserId) {
  var self = this,
    permUserId = recordedByUserId ? recordedByUserId : changedByUserId;
  return self._canCreateDoc(userColId, userDocUUID, permUserId).then(function () { // doc for user?
    return self._canCreateDoc(roleColId, roleDocUUID, permUserId); // doc for role?
  });
};

Process.prototype._getOrCreateAllPartitionsDocs = function (doc) {
  var self = this,
    promises = [];
  self._mainParts.forEach(function (part) {
    promises.push(self._getOrCreateDoc(part, doc));
  });
  return Promise.all(promises);
};

Process.prototype._cacheDoc = function (doc) {
  if (!this._docIds[constants.LATEST][doc.docUUID]) {
    return this._getOrCreateAllPartitionsDocs(doc);
  }
};

Process.prototype._lookupOrCreateUserRoleDocs = function (userDocUUID, roleDocUUID, userColName,
  roleColName, forUserUUID, attr, recordedByUserId) {
  var self = this;
  return self._cacheDoc( // user doc
      {
        docUUID: userDocUUID,
        colName: userColName,
        userUUID: forUserUUID,
        recordedAt: attr.recorded_at,
        updatedAt: attr.updated_at,
        attrName: attr.attr_name,
        attrVal: attr.attr_val,
        recordedByUserId: recordedByUserId
      })
    .then(function () {
      return self._cacheDoc( // role doc
        {
          docUUID: roleDocUUID,
          colName: roleColName,
          userUUID: forUserUUID,
          recordedAt: attr.recorded_at,
          updatedAt: attr.updated_at,
          attrName: attr.attr_name,
          attrVal: attr.attr_val,
          recordedByUserId: recordedByUserId
        });
    });
};

Process.prototype._getDocUUID = function (forUserId, roleUUID) {
  var roleId = this._roleIds[roleUUID],
    promise = Promise.resolve(utils.uuid());
  if (roleId) {
    return this._partitions[constants.LATEST]._docs.getUserRoleDocUUID(forUserId, roleId).then(
      function (docUUID) {
        // could be null if role was already created but user not yet assigned to role
        return docUUID ? docUUID : promise;
      });
  } else { // role missing because role hasn't been created yet so just generate a docUUID
    return promise;
  }
};

// Precondition: _userIds has entry for forUserUUID, _colIds has entry for userColName and
// roleColName
Process.prototype._lookupOrCreateUserRoleDocsIfPermitted = function (userColName, roleColName,
  changedByUserId, forUserUUID,
  attr, roleUUID, recordedByUserId) {
  var self = this,
    forUserId = self._userIds[forUserUUID],
    userDocUUID = null,
    roleDocUUID = null;
  var userColId = self._colIds[userColName],
    roleColId = self._colIds[roleColName];

  return self._getDocUUID(forUserId, roleUUID).then(function (_userDocUUID) {
    userDocUUID = _userDocUUID;
    roleDocUUID = self._userRoles.toRoleUserDocUUID(userDocUUID);
    return self._canCreateUserRoleDocs(userColId, roleColId, userDocUUID, roleDocUUID,
      changedByUserId, recordedByUserId);
  }).then(function () {
    return self._lookupOrCreateUserRoleDocs(userDocUUID, roleDocUUID, userColName,
      roleColName,
      forUserUUID, attr, recordedByUserId);
  }).then(function () {
    return {
      userDocUUID: userDocUUID,
      roleDocUUID: roleDocUUID
    };
  });
};

Process.prototype._destroyAttr = function (index) {
  delete this._deltas[index];
};

// Precondition: userColName & roleColName have entries in _colIds
Process.prototype._canDestroyAttr = function (changedByUserId, userColName, roleColName,
  userDocUUID, roleDocUUID, attrName) {
  var self = this,
    userColId = self._colIds[userColName],
    roleColId = self._colIds[roleColName];
  return self._attrs.canDestroy(changedByUserId, userColId, userDocUUID, attrName)
    .then(function () {
      return self._attrs.canDestroy(changedByUserId, roleColId, roleDocUUID, attrName);
    });
};

Process.prototype._getRecordedByUserId = function (attr) {
  if (attr.super_uuid && this._userIds[attr.super_uuid]) {
    return this._userIds[attr.super_uuid];
  } else {
    return null;
  }
};

// TODO: split up
Process.prototype._takeUserRoleInventoryForAttr = function (index) {
  // TODO: make sure user doesn't specify role user change, only user role change
  var self = this,
    attr = self._deltas[index];

  // When adding a user to a role, we need to check both the user and role permissions. To make this
  // check atomic we take a single change to $ruUSERUUID and dynamically create a corresponding
  // change to $urROLENAME. The permission checks are done here so that we can utilize our existing
  // caching system. If we did the permission checks later then it is possible that we would have
  // access to just the role or the user and this could result in an inconsistency.
  if (attr.attr_name === Doc._roleName) { // adding user to role?

    var userColName = attr.col_name;
    var forUserUUID = self._forUserUUID(attr);
    var action = JSON.parse(attr.attr_val);
    var roleUUID = self._roles.toUUID(action.roleName);
    var roleColName = Cols.NAME_PRE_ROLE_USERS + action.roleName;

    var recordedByUserId = self._getRecordedByUserId(attr);
    var changedByUserId = self._userIds[attr.user_uuid];
    var permUserId = recordedByUserId ? recordedByUserId : changedByUserId;

    var docUUIDs = null;

    if (!attr.user_uuid || changedByUserId) { // was perm to create user?
      return self._lookupOrCreateUserRoleColsIfPermitted(userColName, roleColName,
          changedByUserId,
          forUserUUID, attr, recordedByUserId)
        .then(function () {
          return self._lookupOrCreateUserRoleDocsIfPermitted(userColName, roleColName,
            changedByUserId, forUserUUID, attr,
            roleUUID, recordedByUserId);
        }).then(function (_docUUIDs) {
          docUUIDs = _docUUIDs;
          attr.doc_uuid = docUUIDs.userDocUUID; // pop docUUID from lookup or generation
          if (action.action === UserRoles.ACTION_REMOVE) { // removing user role? Destroy perm
            return self._canDestroyAttr(permUserId, userColName, roleColName,
              docUUIDs.userDocUUId, docUUIDs.roleDocUUId, attr.attr_name);
          }
        }).then(function () {
          // We have permission to modify user and role so dynamically create a change to modify the
          // role users
          var roleUserAttr = utils.clone(attr);

          // Clone sets Dates to strings, is there a better way? Yeah, enhance clone
          roleUserAttr.created_at = attr.created_at;
          roleUserAttr.recorded_at = attr.recorded_at;
          roleUserAttr.updated_at = attr.updated_at;

          roleUserAttr.col_name = roleColName;
          roleUserAttr.attr_name = Doc._roleUserName;
          roleUserAttr.doc_uuid = docUUIDs.roleDocUUID; // pop docUUID from lookup or generation

          self._deltas.push(roleUserAttr);
        }).catch(function (err) {
          if (err instanceof ForbiddenError) {
            log.error('Error looking up or adding user to role, err=' + err.message);
          } else {
            throw err;
          }
          // Destroy attr as don't have perm
          self._destroyAttr(index);
          return Promise.resolve(true);
        });
    } else { // no perm to create user
      // Destroy attr as don't have perm
      self._destroyAttr(index);
      return Promise.resolve(true);
    }
  }
};

// -----

Process.prototype._takeColInventoryForAttr = function (attr) {
  if (utils.notDefined(this._colIds[attr.col_name])) { // lookup/create col?
    var recordedByUserId = this._getRecordedByUserId(attr);
    this._colIds[attr.col_name] = {
      userUUID: attr.user_uuid,
      colName: attr.col_name,
      updatedAt: attr.updated_at,
      recordedByUserId: recordedByUserId
    };
  }
};

Process.prototype._takeDocInventoryForAttr = function (attr) {
  if (utils.notDefined(this._docIds[constants.ALL][attr.doc_uuid])) { // lookup/create doc?
    var recordedByUserId = this._getRecordedByUserId(attr);
    this._docIds[constants.ALL][attr.doc_uuid] = {
      docUUID: attr.doc_uuid,
      userUUID: attr.user_uuid,
      colName: attr.col_name,
      recordedAt: attr.recorded_at,
      updatedAt: attr.updated_at,
      attrName: attr.attr_name,
      attrVal: attr.attr_val,
      recordedByUserId: recordedByUserId
    };
  }
};

Process.prototype._getOrGenDocUUID = function (attr) {
  // TODO: use similar ID-less construct for user roles?
  if (Docs.isIdLess(attr.attr_name)) {
    var action = JSON.parse(attr.attr_val);
    if (action.action === clientUtils.ACTION_ADD) { // creating DB?
      attr.doc_uuid = utils.uuid(); // generate doc UUID as one doesn't already exist
      return Promise.resolve();
    } else { // look up doc UUID
      return this._partitions[constants.LATEST]._docs.findUUID(attr.attr_name, action.name)
        .then(function (docUUID) {
          attr.doc_uuid = docUUID;
          // Note: we don't delete attr_name here as we need it later down the pipeline to determine
          // that this is an id-less doc
        });
    }
  } else {
    return Promise.resolve();
  }
};

Process.prototype._takeInventoryForAttr = function (attr, index) {
  var self = this;

  return self._cacheRoleIds(attr).then(function () {
    // cols and docs are dynamically created based on UserRole so we need to analyze UserRoles first
    return self._takeUserRoleInventoryForAttr(index);
  }).then(function (destroyed) {
    if (!destroyed) { // make sure attr wasn't destroyed, e.g. we don't have both user and role perm
      return self._getOrGenDocUUID(attr).then(function () {
        self._takeColInventoryForAttr(attr);

        self._takeDocInventoryForAttr(attr);
      });
    }
  });
};

Process.prototype._takeInventory = function (deltas) {
  var self = this,
    promises = [];
  deltas.forEach(function (attr, index) {
    promises.push(self._takeInventoryForAttr(attr, index));
  });
  return Promise.all(promises);
};

Process.prototype._lookupOrCreate = function () {
  var self = this;
  return self._lookupOrCreateCols().then(function () {
    return self._lookupOrCreateDocs();
  });
};

Process.prototype._prepareAttrs = function (deltas) {
  // In order to check both user and role permissions when updating user roles we need userIds.
  // In order to prevent doing duplicate creations of cols and docs for this batch, we
  // 1. Loop through all the changes sequentially and take an inventory of all the items that need
  //    to be looked up or created
  // 2. Use non-sequential promises to lookup or create these items
  var self = this;
  return self._cacheUsers(deltas).then(function () {
    return self._takeInventory(deltas);
  }).then(function () {
    return self._lookupOrCreate();
  });
};

// TODO: rename to _processDelta and rename other similar occurrences
Process.prototype._processAttr = function (attr) {
  var self = this;
  return self._createOrUpdateAttrs(attr).then(function () {
    return self._destroyQueueAttrRec(attr); // remove from queue
  }).catch(function (err) {
    // TODO: remove? Is it even possible to get a ForbiddenError here?
    // if (err instanceof ForbiddenError) {
    //   log.error('Error processing attr=' + JSON.stringify(attr) + ', err=' + err.message);
    // } else {
    throw err;
    // }
  });
};

Process.prototype._processAttrs = function (deltas) {
  // TODO: error check for required attrs, e.g. col, id, etc...
  // TODO: throw exception if col or attr name is reserved (starts with $)
  var self = this,
    promises = [];
  deltas.forEach(function (attr) {
    promises.push(self._processAttr(attr));
  });
  return Promise.all(promises);
};

Process.prototype._prepareAndProcessAttrs = function () {
  var self = this;
  return self._prepareAttrs(self._deltas).then(function () {
    return self._processAttrs(self._deltas);
  });
};

Process.prototype.process = function () {
  var self = this;
  // Clear cache so that we don't run out of mem. TODO: only clear if larger than YYY
  self._clearCache();
  return self._queueAttrRecs.get().then(function (deltas) {
    if (deltas) {
      self._deltas = deltas;
      return self._prepareAndProcessAttrs();
    }
  });
};

module.exports = Process;
