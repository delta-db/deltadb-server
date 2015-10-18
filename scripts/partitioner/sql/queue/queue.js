'use strict';

// Note: Our goal with the queue partition is just to dump the data quickly until it can be
// processed. As such, we do not perform any error checking at this level. It is better to have one
// queue table for quicker inserts so that we don't have to create collections, docs and users like
// we do with the other partitions. We utilize a DB table instead of flat files for this so that our
// DB can run using the DB as its only storage mechanism.

// TODO: rename "changes" to "deltas"

var Promise = require('bluebird'),
  QueueAttrRec = require('./queue-attr-rec');

var Queue = function (sql) {
  this._sql = sql;
};

Queue.prototype._createAttr = function (change, quorum, superUUID) {
  var attr = new QueueAttrRec(this._sql, null, change.col, change.id, change.name, change.val,
    change.uid, change.up, change.seq, quorum, change.re, superUUID);
  return attr.create();
};

Queue.prototype.queue = function (changes, quorum, superUUID) {
  var self = this,
    promises = [];
  changes.forEach(function (change) {
    promises.push(self._createAttr(change, quorum, superUUID));
  });
  return Promise.all(promises);
};

module.exports = Queue;
