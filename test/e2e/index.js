'use strict';

/* global before, after */

var ServerProcess = require('../server-process');

describe('e2e', function () {

  var server = new ServerProcess();

  before(function () {
    return server.start('node-server.log', 'node-client.log'); // start the test server
  });

  after(function () {
    return server.stop(); // stop the test server
  });

  require('./basic.js');

  require('./separate.js');

  require('./race.js');

});
