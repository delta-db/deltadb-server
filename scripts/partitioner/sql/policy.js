'use strict';

var utils = require('../../utils'),
  constants = require('./constants'),
  Roles = require('./roles'),
  ColRoles = require('./col/col-roles'),
  UserRoles = require('./user/user-roles'),
  DocRecs = require('./doc/doc-recs'),
  Doc = require('../../client/item'),
  Users = require('./user/users');

var Policy = function (sql, roles, colRoles, userRoles) {
  this._sql = sql;
  this._roles = roles;
  this._colRoles = colRoles;
  this._userRoles = userRoles;
};

Policy.prototype.addRoles = function (all, roles, action, roleActions, name) {
  var self = this;
  if (Array.isArray(roles)) {
    roles.forEach(function (role) {
      role = self._roles.toUUID(role);
      all[role] = true;
      roleActions.push({
        role: role,
        action: action,
        name: name
      });
    });
  } else if (roles) {
    roles = self._roles.toUUID(roles);
    all[roles] = true;
    roleActions.push({
      role: roles,
      action: action,
      name: name
    });
  }
};

Policy.prototype.parsePolicy = function (policy) {
  var self = this,
    all = {},
    roleActions = [];

  if (policy.col) {
    utils.each(policy.col, function (roles, action) {
      self.addRoles(all, roles, action, roleActions);
    });
  }

  if (policy.attrs) {
    utils.each(policy.attrs, function (attr, name) {
      utils.each(attr, function (roles, action) {
        self.addRoles(all, roles, action, roleActions, name);
      });
    });
  }

  return {
    roles: utils.keys(all),
    roleActions: roleActions
  };
};

// TODO: docId not used, but may be used in the future when we implement doc policies
Policy.prototype.setPolicy = function (docId, name, value, changedByUserId, recordedAt,
  updatedAt, seq, restore, quorum, colId, changedByUUID) {
  var self = this,
    rls = self.parsePolicy(value);
  return self._roles.getOrCreateRoles(rls.roles, changedByUserId, changedByUUID).then(function (
    roleIds) {
    return self._colRoles.setColRoles(roleIds, colId, rls.roleActions, updatedAt);
  });
};

Policy.prototype.getPolicy = function (colId) {
  var attrs = {};
  attrs[ColRoles.NAME + '.name'] = 'attr';
  attrs[ColRoles.NAME + '.action'] = 'action';
  attrs[Roles.NAME + '.uuid'] = 'role';

  var joins = {
    joins: {}
  };
  joins.joins[Roles.NAME] = [Roles.NAME + '.id', '=', ColRoles.NAME + '.role_id'];

  var where = [ColRoles.NAME + '.col_id', '=', '"' + colId + '"'];

  // Order by role uuid for testing purposes
  var order = [
    [ColRoles.NAME + '.name', 'asc'],
    [Roles.NAME + '.uuid', 'asc']
  ];

  var self = this;
  return self._sql.find(attrs, ColRoles.NAME, joins, where, order)
    .then(function (results) {
      return self._buildPolicy(results.rows);
    });
};

Policy.prototype._setPolicyRole = function (pol, action, roleUUID) {
  var roleName = this._roles.toName(roleUUID);
  if (!pol[action]) { // not defined yet?
    pol[action] = roleName;
  } else { // not an array
    pol[action] = [pol[action], roleName];
  }
};

Policy.prototype._buildPolicy = function (colRoles) {
  var self = this,
    policy = {};
  if (!colRoles) {
    return policy;
  }
  colRoles.forEach(function (colRole) {
    if (colRole.attr) { // attr policy?
      if (!policy.attrs) { // not defined yet?
        policy.attrs = {};
      }
      if (!policy.attrs[colRole.attr]) { // not defined yet?
        policy.attrs[colRole.attr] = {};
      }
      self._setPolicyRole(policy.attrs[colRole.attr], colRole.action, colRole.role);
    } else { // col policy?
      if (!policy.col) { // not defined yet?
        policy.col = {};
      }
      self._setPolicyRole(policy.col, colRole.action, colRole.role);
    }
  });
  return policy;
};

Policy.prototype.createPolicyIfMissing = function (docId, name, value, changedByUserId, recordedAt,
  updatedAt, seq, restore, quorum, colId, changedByUUID) {
  var self = this;
  return self._colRoles.hasPolicy(colId).then(function (has) {
    if (!has) {
      return self.setPolicy(docId, name, value, changedByUserId, recordedAt, updatedAt, seq,
        restore, quorum, colId, changedByUUID);
    }
  });
};

Policy.prototype.getDefaultPolicy = function (userUUID) {
  // If a user is specified, set the default policy so that only the creator can CRUD so that there
  // isn't a considerable moment where the data is created and not protected by a policy. We need to
  // imagine that the data can be written to our cluster independently from the policy.
  var role = userUUID ? userUUID : Roles.ALL;
  return {
    col: {
      create: [role],
      read: [role],
      update: [role],
      destroy: [role]
    }
  };
};

// TODO: split up!
Policy.prototype.hasColRole = function (userId, action, colId, docUUID, attrName) {
  // Cascading permissions: attr->doc. By default the permissions are full access. We sort the
  // results and take the top result.

  var docs = constants.LATEST + DocRecs.NAME,
    hasRole = null;

  // TODO: moving some entries from where to join would make the query faster??
  var joins = {
    left_joins: {
      user_roles: [UserRoles.NAME + '.role_id', '=', ColRoles.NAME + '.role_id']
    }
  };

  joins.left_joins[docs] = [docs + '.uuid', '=', '"' + docUUID + '"'];

  if (userId) { // logged in?
    joins.left_joins['users'] = ['users.id', '=', '"' + userId + '"'];
    var enabled = ['users.status', '=', '"' + Users.STATUS_ENABLED + '"'];
    hasRole = [
      [
        [UserRoles.NAME + '.user_id', '=', '"' + userId + '"'], 'and', enabled
      ], 'or',

      [
        [ColRoles.NAME + '.role_id', '=', '"' + Roles.ID_OWNER + '"'], 'and', [
          [docs + '.user_id', '=', '"' + userId + '"'], 'and', enabled
        ]
      ], 'or',

      [ColRoles.NAME + '.role_id', '=', '"' + Roles.ID_ALL + '"']
    ];
  } else { // not logged in
    hasRole = [ColRoles.NAME + '.role_id', '=', '"' + Roles.ID_ALL + '"'];
  }

  var where = [
    [ColRoles.NAME + '.col_id', '=', '"' + colId + '"'], 'and',

    hasRole, 'and',

    [ColRoles.NAME + '.name', '=', attrName ? '"' + attrName + '"' : 'null'], 'and',

    [ColRoles.NAME + '.action', '=', '"' + action + '"']
  ];

  return this._sql.find([ColRoles.NAME + '.id'], 'col_roles', joins, where, null, 1)
    .then(function (results) {
      return results.rows ? true : false;
    });
};

// TODO: for this fn and all similar, modify logic so that throws ForbiddenError if no permission as
// this makes it much easier for calling routines to handle logic where there are multiple
// permission checks
Policy.prototype.modPermitted = function (userId, action, colId, docUUID, attrName) {
  var self = this;

  // TODO: we don't really want to check if the user has the $super role each time. We should really
  // do this once per batch of deltas
  return self._userRoles.isSuperUser(userId, Roles.ID_SUPER).then(function (isSuper) {
    if (isSuper) {
      return true;
    }
    return self._colRoles.hasPolicy(colId).then(function (has) {
      if (has) { // has policy?
        if (attrName) { // is an attr being updated?
          return self._colRoles.hasPolicy(colId, attrName).then(function (has) {
            if (has) { // attr policy?
              return self.hasColRole(userId, action, colId, docUUID, attrName);
            } else { // look for doc policy
              return self.hasColRole(userId, action, colId, docUUID, null);
            }
          });
        } else { // no attr name, e.g. no attrName if creating doc
          return self.hasColRole(userId, action, colId, docUUID, null);
        }
      } else { // no policy so everything permitted--could also be first edit
        return true;
      }
    });
  });
};

Policy.prototype.permitted = function (userId, action, colId, docUUID, attrName) {
  // Cascading permissions: col attr, col doc, database attr, database doc
  var self = this;
  return self.modPermitted(userId, action, colId, docUUID, attrName);
};

Policy.prototype.createDefaultPolicy = function (colId, userUUID) {
  // TODO: we are setting the updatedAt to some date in the past, but a better solution is probably
  // to support null updated_at's so that the default col role can always be overwritten.
  var updatedAt = '1981-01-01T00:00:00.000Z';
  var policy = this.getDefaultPolicy(userUUID);
  return this.createPolicyIfMissing(null, Doc._policyName, policy, null, null, updatedAt, null,
    null,
    true, colId, userUUID);
};

module.exports = Policy;