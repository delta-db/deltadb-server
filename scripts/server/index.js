'use strict';

var log = require('../utils/log');
log.setSilent(false); // turn on log

var Server = require('./server'),
  Process = require('./process'),
  System = require('../system'),
  Partitioner = require('../partitioner/sql'),
  Manager = require('../manager');

var server = new Server(),
  process = new Process();

/**
 * Create the system DB if it doesn't already exist
 */
var ensureSystemDBCreated = function () {
  var partitioner = new Partitioner();
  var manager = new Manager(partitioner);
  var system = new System(manager);
  return partitioner.dbExists(partitioner._dbName).then(function (exists) {
    if (!exists) {
      return system.create().then(function () {
        return partitioner.closeDatabase(); // close DB connection to return resources
      });
    }
  });
};

ensureSystemDBCreated().then(function () {
  process.run();
  server.listen();
});
