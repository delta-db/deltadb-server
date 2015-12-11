'use strict';

// Set config so that our test server doesn't interfere with any production server. We need to set
// the config first so that all of the following code uses this config.
var config = require('../config'),
  testConfig = require('./config'),
  clientConfig = require('../scripts/client/config'); // server also uses client
for (var i in testConfig) {
  config[i] = testConfig[i];
  clientConfig[i] = testConfig[i];
}

// Uncomment for debugging
// (function() {
//     var childProcess = require("child_process");
//     var oldSpawn = childProcess.spawn;
//     function mySpawn() {
//         console.log('spawn called');
//         console.log(arguments);
//         var result = oldSpawn.apply(this, arguments);
//         return result;
//     }
//     childProcess.spawn = mySpawn;
// })();

var fs = require('fs'),
  spawn = require('child_process').spawn,
  config = require('../config'),
  Partitioner = require('../scripts/partitioner/sql'),
  Manager = require('../scripts/manager'),
  System = require('../scripts/system'),
  DBMissingError = require('../scripts/client/db-missing-error'),
  log = require('../scripts/client/log'),
  serverLog = require('../scripts/server/log'),
  ServerContainer = require('../scripts/server'),
  LogStream = require('../scripts/utils/log-stream');

serverLog.console(false);

var Server = function (spawn) {
  this._partitioner = new Partitioner();
  this._manager = new Manager(this._partitioner);
  this._system = new System(this._manager);
  this._spawn = spawn;
  this._serverContainer = new ServerContainer();
};

/**
 * Destroy and then create the system DB so that we have a fresh instance and Admin Party is
 * enabled
 */
Server.prototype._destroyAndCreateSystemDB = function () {
  var self = this,
    adminParty = true;
  return self._system.destroy().catch(function (err) {
    // Ignore errors caused from missing DB
    if (!(err instanceof DBMissingError)) {
      throw err;
    }
  }).then(function () {
    // Destroy "mydb" in case a previous set of tests failed and left it behind. This saves us from
    // having to manually remove "mydb" when adding new code that breaks tests.
    return self._partitioner.destroyAnotherDatabase('mydb');
  }).catch(function (err) {
    // Ignore errors caused from "mydb" missing which is actually the expected case as long as the
    // previous set of tests passed
    if (!(err instanceof DBMissingError)) {
      throw err;
    }
  }).then(function () {
    return self._system.create(adminParty);
  }).then(function () {
    return self._partitioner.closeDatabase(); // close DB connection to return resources
  });
};

Server.prototype._doSpawn = function (serverFilename) {
  this._log = fs.createWriteStream('./test/' + serverFilename, {
    flags: 'w'
  });

  this._server = spawn('./bin/deltadb-server', [
    '--port', config.PORT,
    '--prefix', config.DB_NAME_PREFIX
  ]);

  this._server.stdout.pipe(this._log);
  this._server.stderr.pipe(this._log);
};

Server.prototype._start = function (serverFilename) {
  // Spawn the server or run it in the same process? Spawned processes don't trigger code coverage
  // reporting
  if (this._spawn) {
    this._doSpawn(serverFilename);
  } else {
    serverLog.stream(new LogStream('./test/' + serverFilename)); // enable server log
    this._serverContainer.start();
  }
};

Server.prototype._kill = function () {
  this._server.kill();
};

Server.prototype.start = function (serverFilename) {
  var self = this;
  return self._destroyAndCreateSystemDB().then(function () {
    self._start(serverFilename); // start test server
  });
};

Server.prototype.stop = function () {
  var self = this;

  if (self._spawn) {
    self._server.kill(); // kill spawned server
  }

  return self._system.destroy().then(function () {
    return self._partitioner.closeDatabase(); // close DB connection to return resources
  }).then(function () {
    log.stream(false); // disable client log
  });
};

module.exports = Server;
