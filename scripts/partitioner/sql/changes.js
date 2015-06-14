'use strict';

var constants = require('./constants'),
  utils = require('../../utils'),
  ChangesQuery = require('./changes-query');

var Changes = function (sql, globals) {
  this._sql = sql;
  this._globals = globals;
};

Changes.prototype._formatChanges = function (changes) {
  // Remove nulls
  var chngs = [];
  if (changes) {
    changes.forEach(function (change) {
      var chng = {};
      utils.each(change, function (value, name) {
        if (value !== null) {
          if (name === 'up' || name === 're') {
            chng[name] = new Date(value).toISOString();
          } else {
            chng[name] = value;
          }
        }
      });
      chngs.push(chng);
    });
  }
  return chngs;
};

Changes.prototype._changes = function (partition, since, limit, offset, all, userId) {
  var self = this,
    query = new ChangesQuery(self._sql, partition, since, limit, offset, all, userId);
  return query._changes().then(function (results) {
    return self._formatChanges(results.rows);
  });
};

Changes.prototype._latestChanges = function (since, limit, offset, all, userId) {
  return this._changes(constants.LATEST, since, limit, offset, all, userId);
};

Changes.prototype._allChanges = function (since, limit, offset, all, userId) {
  return this._changes(constants.ALL, since, limit, offset, all, userId);
};

// TODO: what is the best value here to keep load down and ensure that responses are managable?
Changes._MAX_LIMIT = 1000;

// since=null => first sync
// Syncing:
// 1. If server--needs complete history: (requires storing last syncd for each server)
//   - if last syncd is before last archived then need to pull all changes from ALL with recorded_at
//     after or on last syncd
//   - if last syncd is after last archived then pull all changes from LATEST with recorded_at after
//     or on last syncd
// 2. If client: (requires storing last syncd for each server)
//   - if last syncd is before last archived then need to pull all changes from LATEST with
//     recorded_at after or on last syncd
//   - if last syncd is after last archived then pull all changes from LATEST with recorded_at after
//     or on last syncd
Changes.prototype._pageOfChanges = function (since, history, limit, offset, all, userId) {

  var self = this;

  if (!since && !history) { // initial sync? just pull from latest_
    return self._latestChanges(null, limit, offset, all, userId);
  }

  return self._globals.get('archived').then(function (archived) {
    if (since && since.getTime() > archived) { // recent?
      if (history) {
        return self._changes(constants.RECENT, since, limit, offset, all, userId);
      } else {
        return self._changes(constants.LATEST, since, limit, offset, all, userId);
      }
    } else if (history) {
      return self._allChanges(since, limit, offset, all, userId);
    } else {
      return self._latestChanges(since, limit, offset, all, userId); // all docs
    }
  });
};

Changes._HAS_MORE = 'more';

Changes.prototype.changes = function (since, history, limit, offset, all, userId) {
  // We request 1 more than limit so that we can check to see if there are more pages. If this extra
  // change is returned, we replace it with Changes._HAS_MORE to indicate that there are more pages.

  var self = this;

  if (limit && limit > Changes._MAX_LIMIT) {
    return utils.promiseError(new Error('limit (' + limit + ') cannot be greater than ' + Changes
      ._MAX_LIMIT));
  }

  if (!limit || limit <= 0) {
    limit = Changes._MAX_LIMIT; // add one so we can see if there are more pages
  }

  offset = offset ? offset : 0;

  return self._pageOfChanges(since, history, limit + 1, offset, all, userId)
    .then(function (changes) {
      if (changes.length > limit) { // more pages?
        changes[limit] = Changes._HAS_MORE; // indicate end
      }
      return changes;
    });
};

module.exports = Changes;