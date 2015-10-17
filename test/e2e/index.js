'use strict';

var log = require('../../scripts/client/log'),
  LogStream = require('../../scripts/utils/log-stream'),
  ServerProcess = require('../server-process'),
  Partitioner = require('../../scripts/partitioner/sql'),
  Manager = require('../../scripts/manager'),
  System = require('../../scripts/system'),
  DBMissingError = require('../../scripts/client/db-missing-error');

describe('e2e', function () {

  var server = new ServerProcess(), // load test config before any
    partitioner = new Partitioner(),
    manager = new Manager(partitioner),
    system = new System(manager);

  /**
   * Destroy and then create the system DB so that we have a fresh instance and Admin Party is enabled
   */
  var destroyAndCreateSystemDB = function () {
    var adminParty = true;
    return system.destroy().catch(function (err) {
      // Ignore errors caused from missing DB
      if ((!err instanceof DBMissingError)) {
        throw err;
      }
    }).then(function () {
      return system.create(adminParty);
    }).then(function () {
      return partitioner.closeDatabase(); // close DB connection to return resources
    });
  };

  before(function () {
    log.stream(new LogStream('./test/client.log')); // enable client log
    return destroyAndCreateSystemDB().then(function () {
      server.spawn(); // start test server
    });
  });

  after(function () {
    server.kill(); // kill test server
    return system.destroy().then(function () {
      return partitioner.closeDatabase(); // close DB connection to return resources
    }).then(function () {
      log.stream(false); // disable client log
    });
  });

  require('./basic.js');

  require('./multiple.js');

});
