'use strict';

/* global before, after */

var ServerProcess = require('../server-process'),
  log = require('deltadb/scripts/log'),
  fs = require('fs');

describe('e2e', function () {

  var server = new ServerProcess();

  before(function () {
    log.stream(fs.createWriteStream('./test/logs/node-client.log', { // enable client log
      'flags': 'w'
    }));
    return server.start('logs/node-server.log'); // start the test server
  });

  after(function () {
    return server.stop(); // stop the test server
  });

  require('./e2e');

});
