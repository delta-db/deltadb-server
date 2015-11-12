'use strict';

// TODO: better to make log file a command line option than output to stdout?
var log = require('../server/log');
log.console(true);

var Server = require('./server'),
  Process = require('./process'),
  System = require('../system'),
  Partitioner = require('../partitioner/sql'),
  Manager = require('../manager');

var process = new Process(),
  server = new Server(process);

/**
 * Create the system DB if it doesn't already exist
 */
var ensureSystemDBCreated = function () {
  var partitioner = new Partitioner();
  var manager = new Manager(partitioner);
  var system = new System(manager);
  var adminParty = true; // allow everyone to CRUD by default
  return partitioner.dbExists(partitioner._dbName).then(function (exists) {
    if (!exists) {
      return system.create(adminParty).then(function () {
        return partitioner.closeDatabase(); // close DB connection to return resources
      });
    }
  });
};

ensureSystemDBCreated().then(function () {
  process.run();
  server.listen();
});
