'use strict';

/* global before, after */

var ServerProcess = require('../server-process'),
  log = require('../../scripts/client/log'),
  LogStream = require('../../scripts/utils/log-stream');

describe('e2e', function () {

  var server = new ServerProcess();

  before(function () {
    log.stream(new LogStream('./test/node-client.log')); // enable client log
    return server.start('node-server.log'); // start the test server
  });

  after(function () {
    return server.stop(); // stop the test server
  });

  require('./e2e');

});
