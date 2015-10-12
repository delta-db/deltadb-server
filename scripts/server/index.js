'use strict';

// TMP - BEGIN
var log = require('../utils/log');
log.setSilent(false);

// TODO: test launcher needs to drop $system (if exists) and then create before the server runs
var Partitioner = require('../partitioner/sql'),
  Manager = require('../manager'),
  System = require('../system');

var ensureDBCreated = function () {
  var partitioner = new Partitioner();
  var manager = new Manager(partitioner);
  var system = new System(manager);
  var adminParty = true;
  return system.destroy().then(function () {
    return system.create(adminParty);
  }).catch(function () {
    // Assume the error is because it doesn't already exist
    return system.create(adminParty).catch(function () {
    });
  }).then(function () {
    return partitioner.closeDatabase();
  });
};
// TMP - END


var Server = require('./server'),
  Process = require('./process');

var server = new Server(),
  process = new Process();

ensureDBCreated().then(function () { // TODO: remove this promise!
  process.run();
  server.listen();
});
