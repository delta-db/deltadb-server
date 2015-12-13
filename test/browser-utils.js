'use strict';

var commonUtils = require('deltadb-common-utils');

/**
 * A utils class which can be included in the browser tests without including any server-side code.
 */
var Utils = function () {};

// Added to prototype so that it can be accessed outside this module
// 8000 ms doesn't appear to long enough for the e2e separate tests in phantomjs
Utils.prototype.TIMEOUT = 10000;

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
  return commonUtils.sort(changes, attrs);
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
