'use strict';

var constants = require('./constants');

var Archive = function (partitions, globals) {
  this._partitions = partitions;
  this._globals = globals;
};

Archive.prototype.destroyBefore = function (partition, before) {
  var self = this;
  return self._partitions[partition]._attrRecs.destroyBefore(before).then(function () {
    return self._partitions[partition]._docs.destroyBefore(before);
  });
};


Archive.prototype.archive = function (before) {
  var self = this;
  return self.destroyBefore(constants.RECENT, before).then(function () {
    return self._globals.set('archived', before.getTime());
  });
};

module.exports = Archive;