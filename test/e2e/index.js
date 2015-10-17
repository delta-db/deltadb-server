'use strict';

// For debugging
// var log = require('../../scripts/utils/log');
// log.setSilent(false);

var ServerProcess = require('../server-process'),
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
    return destroyAndCreateSystemDB().then(function () {
      server.spawn(); // start test server
    });
  });

  after(function () {
    server.kill(); // kill test server
    return system.destroy();
  });

  require('./basic.js');

  require('./multiple.js');

});
