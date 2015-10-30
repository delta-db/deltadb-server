'use strict';

var utils = require('../scripts/utils'),
  clientUtils = require('../scripts/client/utils');

var Utils = function () {};

Utils.prototype.TIMEOUT = 8000;

Utils.prototype.never = function (msg) {
  throw new Error(utils.notDefined(msg) ? 'must never execute' : msg);
};

Utils.prototype._errShouldEql = function (expErr, actErr) {
  if (actErr.message === 'must never execute') { // TODO: define & use NeverException instead
    throw new Error("didn't throw err");
  }

  if (expErr) {
    if (expErr.message) {
      expErr.message.should.eql(actErr.message);
    }

    expErr.name.should.eql(actErr.name);
  } else {
    (actErr === null).should.eql(false);
  }
};

// If err.message is falsy then only ensures that both errors are of the same type
Utils.prototype.shouldThrow = function (fun, err) {
  var self = this;
  return fun().then(function () {
    self.never();
  }).catch(function (_err) {
    self._errShouldEql(err, _err);
  });
};

Utils.prototype.shouldNonPromiseThrow = function (fun, err) {
  try {
    fun();
    this.never();
  } catch (_err) {
    this._errShouldEql(err, _err);
  }
};

Utils.prototype.changesShouldEql = function (expected, actual) {
  this.sortChanges(actual);
  this.sortChanges(expected);
  actual.forEach(function (change, i) {
    if (expected[i] && change.re) {
      expected[i].re = change.re;
    }

    if (expected[i] && change.up) {
      expected[i].up = change.up;
    }

    if (expected[i] && change.id) {
      expected[i].id = change.id;
    }
  });
  this.eqls(expected, actual);
};

Utils.prototype.sortChanges = function (changes) {
  var attrs = ['col', 'name', 'up', 'seq', 'val'];
  return utils.sort(changes, attrs);
};

Utils.prototype.eqls = function (expected, actual) {
  // Convert to milliseconds so that errors report specific problems--expect doesn't compare
  // milliseconds by default
  this.toTime(actual).should.eql(this.toTime(expected));
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

Utils.prototype.sleep = function (sleepMs) {
  // Ensure a different timestamp will be generated after this function resolves.
  // Occasionally, using timeout(1) will not guarantee a different timestamp, e.g.:
  //   1. (new Date()).getTime()
  //   2. timeout(1)
  //   3. (new Date()).getTime()
  // It is not clear as to what causes this but the solution is to sleep longer. This function is
  // also used to delay between DB writes to create predictable patterns. In this case it may be
  // that the DB adapter processes queries out of sequence.
  return clientUtils.timeout(sleepMs ? sleepMs : 10);
};

Utils.prototype.allShouldEql = function (collection, expected) {
  // Index data as order is guaranteed

  var allDocs = {};

  var allExpDocs = {};
  expected.forEach(function (exp) {
    allExpDocs[exp.$id] = exp;
  });

  return collection.all(function (item) {
    allDocs[item.id()] = item.get();
  }).then(function () {
    allDocs.should.eql(allExpDocs);
  });
};

Utils.prototype.shouldDoAndOnce = function (promiseFactory, emitter, evnt) {
  var self = this,
    err = true;

  var doOncePromise = utils.doAndOnce(promiseFactory, emitter, evnt).then(function (args) {
    err = false;
    return args;
  });

  // 100 ms appears to be too short on Chrome for ost of our tests
  return clientUtils.timeout(200).then(function () {
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
  return clientUtils.timeout(100).then(function () {
    if (err) {
      self.never('should not have emitted event ' + evnt);
    }
  });
};

module.exports = new Utils();
