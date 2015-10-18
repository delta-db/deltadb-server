'use strict';

var Promise = require('bluebird'),
  AttrRecs = require('./attr/attr-recs'),
  DocRecs = require('./doc/doc-recs'),
  AttrRoles = require('./attr/attr-roles');

var Partition = function (sql, name, policy, userRoles, partitioner) {
  this._sql = sql;
  this._attrRecs = new AttrRecs(sql, name);
  // TODO: rename _docs to _docRecs
  this._docs = new DocRecs(sql, name, policy, this._attrRecs, userRoles, partitioner);
  this._attrRoles = new AttrRoles(sql, name);
  this._models = [this._attrRecs, this._docs, this._attrRoles];
};

Partition.prototype.createTables = function () {
  var promises = [];
  this._models.forEach(function (model) {
    promises.push(model.createTable());
  });
  return Promise.all(promises);
};

Partition.prototype.truncateTables = function () {
  var promises = [];
  this._models.forEach(function (model) {
    promises.push(model.truncateTable());
  });
  return Promise.all(promises);
};

module.exports = Partition;
