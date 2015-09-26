'use strict';

// TMP - BEGIN
var log = require('../utils/log');
log.setSilent(false);

var Partitioner = require('../partitioner/sql');
// var utils = require('../utils');
var ensureDBCreated = function () {
  // TODO: this is temporary as the DB should really be created by connecting to $system first
  // Try to create DB and then if it fails, because it already exists, just connect

  var part = new Partitioner('mydb');

  var connectAndCreateAndClose = function () {
    return part.connectAndCreate().then(function () {
      return part.closeDatabase();    
    });
  };

  var connectAndDestroy = function () {
    return part.connect().then(function () {
      return part.destroyDatabase();
    });
  };

  return connectAndDestroy().then(function () {
    return connectAndCreateAndClose();
  }).catch(function () {
    return connectAndCreateAndClose();
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