'use strict';

var chai = require('chai');
chai.use(require('chai-as-promised'));
chai.should(); // var should = chai.should();

var ServerProcess = require('../server-process'),
  log = require('deltadb/scripts/log'),
  fs = require('fs');

describe('performance', function () {

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
  require('./delta');
  require('./raw-orm');
  require('./raw-postgres');
  require('./raw-mysql');
});
