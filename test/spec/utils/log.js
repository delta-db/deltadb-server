'use strict';

/* global before, after */

var Log = require('../../../scripts/utils/log');

describe('log', function () {

  var stockConsoleLog = null,
    consoleLogCount = 0,
    log = null;

  before(function () {
    stockConsoleLog = console.log;
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
    log.console(false); // turn it off for proceeding tests
  });

  it('should log stream', function () {
    var stream = { // mock
      write: function () { }
    };

    log.stream(stream);
    log.error('some error');
    log.stream(null); // restore
  });

  it('should ignore if no stream or console', function () {
    log.info('ignore this');
  });

});
