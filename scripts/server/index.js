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

// TODO: rename? Or rename Server in server.js?
var ServerContainer = function () {
  this._partitioner = new Partitioner();
  this._manager = new Manager(this._partitioner);
  this._system = new System(this._manager);
};

ServerContainer.prototype._createSystemAndClose = function () {
  var self = this;
  var adminParty = true; // allow everyone to CRUD by default
  return self._system.create(adminParty).then(function () {
    return self._partitioner.closeDatabase(); // close DB connection to return resources
  });
};

/**
 * Create the system DB if it doesn't already exist
 */
ServerContainer.prototype._ensureSystemDBCreated = function () {
  var self = this;
  return self._partitioner.dbExists(self._partitioner._dbName).then(function (exists) {
    if (!exists) {
      return self._createSystemAndClose();
    }
  });
};

ServerContainer.prototype.start = function () {
  return this._ensureSystemDBCreated().then(function () {
    process.run();
    server.listen();
  });
};

module.exports = ServerContainer;
