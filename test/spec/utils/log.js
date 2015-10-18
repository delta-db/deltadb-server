'use strict';

/* global before, after */

var Log = require('../../../scripts/utils/log');

describe('log', function () {

  var stockConsoleLog = console.log,
    consoleLogCount = 0,
    log = null;

  before(function () {
    console.log = function () {
      consoleLogCount++;
    };
  });

  after(function () {
    console.log = stockConsoleLog;
  });

  beforeEach(function () {
    log = new Log();
  });

  it('should output to console', function () {
    log.console(true);
    log.info('my info msg');
  });

});
