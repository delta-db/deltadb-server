'use strict';

var utils = require('../../../../utils'),
  constants = require('../../../../../scripts/partitioner/sql/constants');

var Utils = function (db) {
  this._db = db;
};

Utils.prototype.queueAndProcess = function (changes) {
  // Force quorum=true. We will test the processing of quorum elsewhere
  return utils.queueAndProcess(this._db, changes, true);
};

Utils.prototype.docs = function (partition, destroyedAt, updatedAt) {
  // TODO: ensure rows[0].recorded_at is from the last couple seconds
  return utils.docsShouldEql(this._db, partition, [{
    uuid: '1',
    destroyed_at: (destroyedAt ? destroyedAt : null),
    last_destroyed_at: (destroyedAt ? destroyedAt : null),
    updated_at: updatedAt
  }]);
};

Utils.prototype.allDocs = function (destroyedAt, updatedAt) {
  var self = this;
  return self.docs(constants.ALL, destroyedAt, updatedAt).then(function () {
    return self.docs(constants.RECENT, destroyedAt, updatedAt);
  }).then(function () {
    return self.docs(constants.LATEST, destroyedAt, updatedAt);
  });
};

module.exports = Utils;
