'use strict';

var Promise = require('bluebird');

var ForbiddenError = require('../forbidden-error'),
  constants = require('../constants');

var Attr = require('./attr'),
  AttrParams = require('./attr-params');

var Attrs = function (partitions, policy, users, roles, partitioner) {
  this._partitions = partitions;
  this._policy = policy;
  this._users = users;
  this._roles = roles;
  this._partitioner = partitioner;

  // TODO: better to have "parent" and children depend on parent?
  this._docs = null; // circular dependency so set after instantiation.
};

Attrs.prototype.createLatestAndAllAndRecentAndRecentAttrs = function (attrs, updatedAt, restore,
  docUUID, colId, userUUID) {
  var self = this,
    promises = [];
  attrs.forEach(function (attr) {

    var sql = self._partitions[constants.LATEST]._docs._sql;

    var params = new AttrParams();
    params.setWithRow(attr);

    // Set seq num to -1 for restored attrs so that any restoring changes take precedence
    params.seq = -1;
    params.restore = restore;
    params.updatedAt = updatedAt;
    params.docUUID = docUUID;
    params.colId = colId;
    params.userUUID = userUUID;

    var at = new Attr(sql, constants.LATEST, self._policy, self._partitions, self._users,
      self._docs, params, self._roles, self._partitioner);

    promises.push(at.createLatestAndAllAndRecentAndRecentAttr());

  });
  return Promise.all(promises);
};

Attrs.prototype.canDestroy = function (userId, colId, docUUID, attrName) {
  return this._policy.permitted(userId, constants.ACTION_DESTROY, colId, docUUID, attrName)
    .then(function (allowed) {
      if (!allowed) {
        throw new ForbiddenError('cannot destroy attr ' + attrName + ' (docUUID=' + docUUID +
          ')');
      }
    });
};

module.exports = Attrs;
