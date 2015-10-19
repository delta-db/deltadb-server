'use strict';

var utils = require('../scripts/utils');

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

module.exports = new Utils();
