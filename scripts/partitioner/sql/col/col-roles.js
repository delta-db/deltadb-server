'use strict';

var Promise = require('bluebird'),
  utils = require('../../../utils'),
  constants = require('../constants'),
  Dictionary = require('../../../utils/dictionary'),
  Cols = require('./cols'),
  Roles = require('../roles'),
  log = require('../../../server/log');

var ColRoles = function (sql) {
  this._sql = sql;
};

ColRoles.NAME = 'col_roles';

ColRoles.prototype._nextReservedRecId = 1;

ColRoles.prototype._addReservedRecs = function (recs, colId, roleId) {
  recs[this._nextReservedRecId++] = {
    col_id: colId,
    role_id: roleId,
    action: constants.ACTION_CREATE
  };
  recs[this._nextReservedRecId++] = {
    col_id: colId,
    role_id: roleId,
    action: constants.ACTION_READ
  };
  recs[this._nextReservedRecId++] = {
    col_id: colId,
    role_id: roleId,
    action: constants.ACTION_UPDATE
  };
  recs[this._nextReservedRecId++] = {
    col_id: colId,
    role_id: roleId,
    action: constants.ACTION_DESTROY
  };
};

ColRoles.ID_LAST_RESERVED = constants.ID_LAST_RESERVED;

ColRoles.prototype.createTable = function () {

  var self = this;

  var schema = {
    id: {
      type: 'primary'
    },
    col_id: {
      type: 'key'
    },
    name: {
      type: 'varchar',
      length: 100,
      index: true
    },
    role_id: {
      type: 'key',
      null: false
    },
    action: {
      type: 'enum',
      values: ['create', 'read', 'update', 'destroy'],
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

  var unique = [{
    attrs: ['col_id', 'name', 'role_id', 'action'],
    full: ['name']
  }, {
    attrs: ['col_id', 'role_id', 'action'],
    null: ['name']
  }];

  return self._sql.createTable(ColRoles.NAME, schema, unique, ColRoles.ID_LAST_RESERVED).then(
    function () {
      return self.createReserved();
    });

};

ColRoles.prototype.truncateTable = function () {
  var self = this;
  return self._sql.truncateTable(ColRoles.NAME, 'id', ColRoles.ID_LAST_RESERVED).then(function () {
    return self.createReserved();
  });
};

ColRoles.prototype.create = function (colId, name, roleId, action, updatedAt) {
  return this._sql.insert({
      col_id: colId,
      name: (name ? name : null),
      role_id: roleId,
      action: action,
      updated_at: updatedAt
    },
    ColRoles.NAME, 'id');
};

ColRoles.prototype.reserved = function () {
  var recs = {};

  this._addReservedRecs(recs, Cols.ID_ROLE_USERS_SUPER, Roles.ID_SUPER);
  this._addReservedRecs(recs, Cols.ID_USER_ROLES_SUPER, Roles.ID_SUPER);

  return recs;
};

ColRoles.prototype.createReserved = function () {
  var self = this,
    recs = self.reserved(),
    promises = [];
  utils.each(recs, function (rec) {
    promises.push(self.create(rec.col_id, null, rec.role_id, rec.action, new Date()));
  });
  return Promise.all(promises);
};

ColRoles.prototype.update = function (colId, name, roleId, action, updatedAt) {
  // Use updatedAt to prevent race conditions. Use <= so that back-to-back updates don't fail, e.g.
  // set DB policy to $all and then refine with more exclusive policy.
  return this._sql.update({
      col_id: colId,
      name: name,
      role_id: roleId,
      action: action,
      updated_at: updatedAt
    },
    ColRoles.NAME, [
      [
        ['col_id', '=', '"' + colId + '"'], 'and', ['name', '=', '"' + name + '"'], 'and', [
          'role_id', '=', '"' + roleId + '"'
        ], 'and', ['action', '=', '"' + action + '"']
      ], 'and', ['updated_at', '<=', '"' + updatedAt.toISOString() + '"']
    ]);
};

ColRoles.prototype.replace = function (colId, name, roleId, action, updatedAt) {
  var self = this;
  return self.create(colId, name, roleId, action, updatedAt).catch(function () {
    return self.update(colId, name, roleId, action, updatedAt);
  });
};

ColRoles.prototype.destroy = function (colRoleId, updatedAt) {
  // Use updatedAt to prevent race conditions. Use <= so that back-to-back updates don't fail, e.g.
  // set DB policy to $all and then refine with more exclusive policy.
  return this._sql.destroy(ColRoles.NAME, [
    ['id', '=', '"' + colRoleId + '"'], 'and', ['updated_at', '<=', '"' + updatedAt.toISOString() +
      '"'
    ]
  ]);
};

ColRoles.prototype.getColRoles = function (colId) {
  return this._sql.find(['id', 'role_id', 'name', 'action'], ColRoles.NAME, null, ['col_id', '=',
      '"' + colId + '"'
    ])
    .then(function (results) {
      var colRoles = new Dictionary();
      if (results.rows) {
        results.rows.forEach(function (row) {
          colRoles.set(row.role_id, row.action, row.name, row.id);
        });
      }
      return colRoles;
    });
};

ColRoles.prototype.setColRoles = function (roleIds, colId, roleActions, updatedAt) {
  var self = this;
  return self.getColRoles(colId).then(function (remColRoles) {
    var modColRoles = new Dictionary();
    roleActions.forEach(function (roleAction) {
      var roleId = roleIds[roleAction.role],
        name = roleAction.name ? roleAction.name : null;
      if (remColRoles.exists(roleId, roleAction.action, name)) { // exists?
        remColRoles.destroy(roleId, roleAction.action, name);
      } else { // new?
        modColRoles.set(roleId, roleAction.action, name, null);
      }
    });

    var numReplacements;

    return self.replaceColRoles(colId, modColRoles, updatedAt).then(function (n) {
      numReplacements = n;
      return self.destroyColRoles(remColRoles, updatedAt);
    }).then(function (numDestroys) {
      // No changes? Log warning so that we can see that the client is trying to replace an existing
      // policy
      if (numReplacements === 0 && numDestroys === 0) {
        log.warning('Policy already exists so there will be no change, policy=' + JSON.stringify(
          roleActions));
      }
      return null; // prevent runaway promise warnings
    });
  });
};

ColRoles.prototype.replaceColRoles = function (colId, colRoles, updatedAt) {
  var self = this,
    promises = [];

  colRoles.each(function (value, keys) {
    var roleId = keys[0],
      action = keys[1],
      name = keys[2];
    promises.push(self.replace(colId, name, roleId, action, updatedAt).then(function (id) {
      colRoles.set(roleId, action, name, id);
    }));
  });

  var n = promises.length;

  return Promise.all(promises).then(function () {
    return n; // number of replacements
  });
};

ColRoles.prototype.destroyColRoles = function (colRoles, updatedAt) {
  var self = this,
    promises = [],
    n = 0;

  colRoles.each(function (colRoleId /*, keys */ ) {
    n++;
    promises.push(self.destroy(colRoleId, updatedAt));
  });
  return Promise.all(promises).then(function () {
    return n; // number destroyed
  });
};

ColRoles.prototype.hasPolicy = function (colId, attrName) {
  var where = ['col_id', '=', '"' + colId + '"'];
  if (typeof attrName !== 'undefined') {
    where = [where, 'and', 'name', '=', attrName ? '"' + attrName + '"' : 'null'];
  }
  return this._sql.find(['id'], ColRoles.NAME, null, where, null, 1)
    .then(function (results) {
      return results.rows ? true : false;
    });
};

module.exports = ColRoles;
