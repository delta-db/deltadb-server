'use strict';

var Promise = require('bluebird'),
  utils = require('../scripts/utils'),
  Cols = require('../scripts/partitioner/sql/col/cols'),
  ColRoles = require('../scripts/partitioner/sql/col/col-roles'),
  Docs = require('../scripts/partitioner/sql/doc/doc-recs'),
  Users = require('../scripts/partitioner/sql/user/users'),
  Roles = require('../scripts/partitioner/sql/roles'),
  commonUtils = require('./common-utils');

var Utils = function () {};

Utils.TIMEOUT = 8000;

Utils.prototype.setUp = function (thisArg) {
  thisArg.timeout(Utils.TIMEOUT); // increase timeout
};

Utils.prototype.toTime = function (rows) {
  rows.forEach(function (cells) {
    for (var j in cells) {
      if (cells[j] instanceof Date) {
        cells[j] = cells[j].getTime();
      }
    }
  });
  return rows;
};

Utils.prototype.eqls = function (expected, actual) {
  // Convert to milliseconds so that errors report specific problems--expect doesn't compare
  // milliseconds by default
  this.toTime(actual).should.eql(this.toTime(expected));
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
    utils.each(exp, function (val, j) {
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
  utils.each(expected, function (item, i) {
    expected[i] = utils.merge(actual[i], item);
  });
  actual.should.eql(expected);
};

Utils.prototype.timeout = function (ms) {
  return new Promise(function (resolve) {
    setTimeout(function () {
      resolve();
    }, ms);
  });
};

Utils.prototype.sleep = function () {
  // Ensure a different timestamp will be generated after this function resolves.
  // Occasionally, using timeout(1) will not guarantee a different timestamp, e.g.:
  //   1. (new Date()).getTime()
  //   2. timeout(1)
  //   3. (new Date()).getTime()
  // It is not clear as to what causes this but the solution is to sleep longer. This function is
  // also used to delay between DB writes to create predictable patterns. In this case it may be
  // that the DB adapter processes queries out of sequence.
  return this.timeout(10);
};

Utils.prototype._toDate = function (val) {
  return val instanceof Date ? val : new Date(val);
};

Utils.prototype.allShouldEql = function (collection, expected) {
  return collection.all().then(function (items) {
    var allDocs = [];
    return items.each(function (item) {
      allDocs.push(item.get());
    }).then(function () {
      allDocs.should.eql(expected);
    });
  });
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
    expected[i] = utils.merge({
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
  var sortAttrs = ['doc_id', 'name', 'updated_at', 'seq', 'value'];
  return utils.sort(attrs, sortAttrs);
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
    expected[i] = utils.merge({
      id: actual[i].id,
      doc_id: actual[i] ? actual[i].doc_id : null,
      name: null,
      value: null,
      changed_by_user_id: actual[i] ? actual[i].changed_by_user_id : null,
      seq: 0,
      quorum: quorum ? quorum : null,
      uid: actual[i].uid,
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

Utils.prototype.sortChanges = function (changes) {
  var attrs = ['col', 'name', 'up', 'seq', 'val'];
  return utils.sort(changes, attrs);
};

Utils.prototype.findColRoles = function (db, where) {
  where = utils.notDefined(where) ? ['col_id', '>=', this.colId] : where;
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

Utils.prototype.queueAndProcessEach = function (db, changes, quorum, superUUID) {
  var self = this,
    chain = Promise.resolve();
  changes.forEach(function (change) {
    chain = chain.then(function () {
      return self.queueAndProcess(db, [change], quorum, superUUID).then(function () {
        return self.sleep();
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

Utils.prototype.never = function () {
  // TODO: change all callers to use commonUtils
  return commonUtils.never.apply(this, arguments);
};

Utils.prototype.shouldThrow = function () {
  // TODO: change all callers to use commonUtils
  return commonUtils.shouldThrow.apply(this, arguments);
};

// TODO: refactor test code to use this more
Utils.prototype.promiseErrorFactory = function (err) {
  return function () {
    return new Promise(function () {
      throw err;
    });
  };
};

// TODO: refactor test code to use this more
Utils.prototype.promiseResolveFactory = function (data) {
  return utils.resolveFactory(data);
};

Utils.prototype.changesShouldEql = function (expected, actual) {
  this.sortChanges(actual);
  this.sortChanges(expected);
  actual.forEach(function (change, i) {
    if (expected[i] && change.re) {
      expected[i].re = change.re;
    }
  });
  this.eqls(expected, actual);
};

Utils.prototype.shouldDoAndOnce = function (promiseFactory, emitter, evnt) {
  var self = this,
    err = true;

  var doOncePromise = utils.doAndOnce(promiseFactory, emitter, evnt).then(function (args) {
    err = false;
    return args;
  });

  return self.timeout(100).then(function () {
    if (err) {
      self.never('should have emitted event ' + evnt);
    }
    return doOncePromise;
  });
};

// Execute promise and wait to make sure that event is not emitted
Utils.prototype.shouldDoAndNotOnce = function (promiseFactory, emitter, evnt) {
  var self = this,
    err = false;
  utils.doAndOnce(promiseFactory, emitter, evnt).then(function () {
    err = true;
  });
  return self.timeout(100).then(function () {
    if (err) {
      self.never('should not have emitted event ' + evnt);
    }
  });
};

module.exports = new Utils();