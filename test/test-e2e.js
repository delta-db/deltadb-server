'use strict';

var chai = require('chai');
chai.use(require('chai-as-promised'));
chai.should(); // var should = chai.should();

// Set config so that our test server doesn't interfere with any production server
var config = require('../config'),
  testConfig = require('./config');
for (var i in testConfig) {
  config[i] = testConfig[i];
}

var ServerProcess = require('./server-process'),
  Partitioner = require('../scripts/partitioner/sql'),
  Manager = require('../scripts/manager'),
  System = require('../scripts/system'),
  DBMissingError = require('../scripts/client/db-missing-error');

describe('deltadb', function () {

  var server = new ServerProcess(); // load test config before any

  /**
   * Destroy and then create the system DB so that we have a fresh instance and Admin Party is enabled
   */
  var destroyAndCreateSystemDB = function () {
    var partitioner = new Partitioner();
    var manager = new Manager(partitioner);
    var system = new System(manager);
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
  });

  require('./e2e');

});
