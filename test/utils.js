'use strict';

var Promise = require('bluebird'),
  commonUtils = require('deltadb-common-utils'),
  Cols = require('../scripts/partitioner/sql/col/cols'),
  ColRoles = require('../scripts/partitioner/sql/col/col-roles'),
  Docs = require('../scripts/partitioner/sql/doc/doc-recs'),
  Users = require('../scripts/partitioner/sql/user/users'),
  Roles = require('../scripts/partitioner/sql/roles'),
  commonTestUtils = require('deltadb-common-utils/scripts/test-utils'),
  clientUtils = require('deltadb/scripts/utils'),
  clientTestUtils = require('deltadb/test/utils'),
  browserTestUtils = require('./browser/utils');

var Utils = function () {};

// Added to prototype so that it can be accessed outside this module
Utils.prototype.TIMEOUT = browserTestUtils.TIMEOUT;

Utils.prototype.setUp = function (thisArg) {
  thisArg.timeout(this.TIMEOUT); // increase timeout
};

Utils.prototype.eql = function (v1, v2) {
  // If the v1 and v2 are dates and v1.toISOString() === v2.toISOString(), v may not be === to v2
  // and for the sake of testing, it should be
  if (v1 instanceof Date && v2 instanceof Date) {
    return v1.toISOString() === v2.toISOString();
  }
  return v1 === v2;
};

/**
 * Chai's should doesn't always output which piece of data is different, e.g. it just says they
 * aren't equal so we can use the following to check ourselves when we are stuck.
 */
Utils.prototype.shouldEql = function (expected, actual) {
  if (expected === null && actual === null) {
    return;
  }

  if (!Array.isArray(expected)) {
    throw new Error('expected not array');
  }

  if (!Array.isArray(expected)) {
    throw new Error('actual not array');
  }

  if (expected.length !== actual.length) {
    throw new Error(
      'expected.length(' + expected.length + ')!=actual.length(' + actual.length + ')');
  }

  var toStr = function (val) {
    // in case milliseconds differ
    return val instanceof Date ? val.toISOString() + '(' + val.getTime() + ')' : val;
  };

  var self = this;
  expected.forEach(function (exp, i) {
    if (!actual[i]) {
      throw new Error("actual[" + i + "] doesn't exist");
    }
    commonUtils.each(exp, function (val, j) {
      if (typeof actual[i][j] === 'undefined') {
        throw new Error("actual[" + i + "][" + j + "] doesn't exist");
      }

      if (!self.eql(actual[i][j], val)) {
        throw new Error('expected[' + i + '][' + j + '](' + toStr(val) + ')!=actual[' + i +
          '][' + j + '](' + toStr(actual[i][j]) + ')');
      }
    });

  });
};

Utils.prototype.contains = function (expected, actual) {
  commonUtils.each(expected, function (item, i) {
    expected[i] = commonUtils.merge(actual[i], item);
  });
  actual.should.eql(expected);
};

Utils.prototype.timeout = function () {
  // TODO: change all callers to use commonUtils
  return commonUtils.timeout.apply(commonUtils, arguments);
};

Utils.prototype.sleep = function ( /* sleepMs */ ) {
  // TODO: change all callers to use clientTestUtils
  return clientTestUtils.sleep.apply(clientTestUtils, arguments);
};

Utils.prototype._toDate = function (val) {
  return val instanceof Date ? val : new Date(val);
};

Utils.prototype.allShouldEql = function ( /* collection, expected */ ) {
  // TODO: change all callers to use clientUtils
  return clientTestUtils.allShouldEql.apply(clientUtils, arguments);
};

// docUUID id of first data attr
Utils.prototype.docUUID = (Cols.ID_LAST_RESERVED + 1) + '';

// col id of first data attr
Utils.prototype.colId = Cols.ID_LAST_RESERVED + 1;

Utils.prototype.findCols = function (db) {
  return db._sql.find(null, 'cols', null, ['id', '>=', this.colId], ['id', 'asc']);
};

// doc id of first data attr, skip policy
Utils.prototype.docId = Docs.ID_LAST_RESERVED + 2;

Utils.prototype.findDocs = function (db, partition, where) {
  var whereId = ['id', '>=', this.docId];
  where = where ? [whereId, 'and', where] : whereId;
  return db._sql.find(null, partition + 'docs', null, where, ['id', 'asc']);
};

Utils.prototype.docsEql = function (expected, actual) {
  var self = this,
    dates = ['destroyed_at', 'last_destroyed_at', 'recorded_at', 'updated_at'];
  expected.forEach(function (doc, i) {
    dates.forEach(function (j) {
      if (doc[j]) {
        doc[j] = self._toDate(doc[j]);
      }
    });
    expected[i] = commonUtils.merge({
      id: actual[i] ? actual[i].id : null,
      uuid: null,
      col_id: self.colId,
      user_id: actual[i] ? actual[i].user_id : null,
      destroyed_at: null,
      last_destroyed_at: doc.destroyed_at ? doc.destroyed_at : null,
      recorded_at: actual[i] ? actual[i].recorded_at : null,
      updated_at: actual[i] ? actual[i].updated_at : null,
    }, doc);
  });

  // Use custom eql fn as sometimes mocha doesn't provide enough details, e.g. when timestamp off by
  // 1 ms
  // this.shouldEql(expected, actual);

  actual.should.eql(expected);
};

Utils.prototype.docsShouldEql = function (db, partition, expected, where) {
  var self = this;
  return self.findDocs(db, partition, where).then(function (results) {
    // console.log('docs='); console.log(results);
    self.docsEql(expected, results.rows);
  });
};

Utils.prototype.attrId = 2; // skip policy

Utils.prototype.findAttrs = function (db, partition, where) {
  // Need to sort by doc_id and name so that results are deterministic as no guarantee on order of
  // insertions
  var whereId = ['doc_id', '>=', this.docId];
  where = where ? [whereId, 'and', where] : whereId;
  return db._sql.find(null, partition + 'attrs', null, where, [
    ['doc_id', 'asc'],
    ['name', 'asc'],
    ['updated_at', 'asc'],
    ['seq', 'asc'],
    ['value', 'asc']
  ]);
};

Utils.prototype.sortAttrs = function (attrs) {
  var sortAttrs = ['doc_id', 'name', 'updated_at', 'seq', 'value', 'quorum'];
  return commonUtils.sort(attrs, sortAttrs);
};

Utils.prototype.attrsEql = function (expected, actual, quorum) {
  var self = this,
    dates = ['destroyed_at', 'recorded_at', 'updated_at'];
  this.sortAttrs(actual);
  this.sortAttrs(expected);
  expected.forEach(function (attr, i) {
    dates.forEach(function (j) {
      if (attr[j]) {
        attr[j] = self._toDate(attr[j]);
      }
    });
    expected[i] = commonUtils.merge({
      id: actual[i].id,
      doc_id: actual[i] ? actual[i].doc_id : null,
      name: null,
      value: null,
      changed_by_user_id: actual[i] ? actual[i].changed_by_user_id : null,
      seq: 0,
      quorum: quorum ? quorum : null,
      omit: actual[i] ? actual[i].omit : null,
      recorded_at: actual[i].recorded_at,
      updated_at: actual[i].updated_at,
    }, attr);
  });
  actual.should.eql(expected);
};

Utils.prototype.attrsShouldEql = function (db, partition, expected, quorum, where) {
  var self = this;
  return self.findAttrs(db, partition, where).then(function (results) {
    // console.log('attrs='); console.log(results);
    self.attrsEql(expected, results.rows, quorum);
  });
};

Utils.prototype.findColRoles = function (db, where) {
  where = commonUtils.notDefined(where) ? ['col_id', '>=', this.colId] : where;
  return db._sql.find(null, ColRoles.NAME, null, where, [
    ['col_id', 'asc'],
    ['name', 'asc'],
    ['action', 'asc'],
    ['role_id', 'asc']
  ]);
};

Utils.prototype.colRolesEql = function (expected, actual) {
  this.contains(expected, actual);
};

Utils.prototype.colRolesShouldEql = function (db, expected, where) {
  var self = this;
  return self.findColRoles(db, where).then(function (results) {
    // console.log('colRoles='); console.log(results);
    self.colRolesEql(expected, results.rows);
  });
};

Utils.prototype.queueAndProcess = function (db, changes, quorum, superUUID) {
  return db.queue(changes, quorum, superUUID).then(function () {
    return db.process();
  });
};

Utils.prototype.queueAndProcessEach = function (db, changes, quorum, superUUID, sleepMs) {
  var self = this,
    chain = Promise.resolve();
  changes.forEach(function (change) {
    chain = chain.then(function () {
      return self.queueAndProcess(db, [change], quorum, superUUID).then(function () {
        return self.sleep(sleepMs);
      });
    });
  });
  return chain;
};

// Helper function so that userId doesn't have to be looked up externally
Utils.prototype.changes = function (partitioner, since, history, limit, offset, all, userUUID) {
  return partitioner._users.getUserId(userUUID).then(function (userId) {
    return partitioner.changes(since, history, limit, offset, all, userId);
  });
};

Utils.prototype.keys = function (obj) {
  var keys = [];
  this.each(obj, function (key) {
    keys.push(key);
  });
  return keys;
};

Utils.prototype.dump = function (db, table) {
  return db._sql.find(null, table).then(function (results) {
    console.log('dump of ' + table + '=');
    console.log(results);
  });
};

Utils.prototype.userId = Users.ID_LAST_RESERVED + 1;

Utils.prototype.roleId = Roles.ID_LAST_RESERVED + 1;

Utils.prototype.shouldDoAndOnce = function ( /* promiseFactory, emitter, evnt */ ) {
  // TODO: change all callers to use commonTestUtils
  return commonTestUtils.shouldDoAndOnce.apply(commonTestUtils, arguments);
};

// Execute promise and wait to make sure that event is not emitted
Utils.prototype.shouldDoAndNotOnce = function ( /* promiseFactory, emitter, evnt */ ) {
  // TODO: change all callers to use commonTestUtils
  return commonTestUtils.shouldDoAndNotOnce.apply(commonTestUtils, arguments);
};

Utils.prototype.changesShouldEql = function ( /* expected, actual */ ) {
  return browserTestUtils.changesShouldEql.apply(browserTestUtils, arguments);
};

Utils.prototype.sortChanges = function ( /* changes */ ) {
  return browserTestUtils.sortChanges.apply(browserTestUtils, arguments);
};

Utils.prototype.eqls = function ( /* expected, actual */ ) {
  return browserTestUtils.eqls.apply(browserTestUtils, arguments);
};

Utils.prototype.toTime = function ( /* rows */ ) {
  return browserTestUtils.toTime.apply(browserTestUtils, arguments);
};

module.exports = new Utils();
