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
  }).catch(function (err) {
    // Assume the error is because it doesn't already exist
    return system.create(adminParty);
  });
};

// var Partitioner = require('../partitioner/sql');
// // var utils = require('../utils');
// var ensureDBCreated = function () {
//   // TODO: this is temporary as the DB should really be created by connecting to $system first
//   // Try to create DB and then if it fails, because it already exists, just connect

//   var part = new Partitioner('mydb');

//   var connectAndCreateAndClose = function () {
//     return part.createDatabase().then(function () {
//       return part.closeDatabase();
//     });
//   };

//   var connectAndDestroy = function () {
//     return part.connect().then(function () {
//       return part.destroyDatabase();
//     });
//   };

//   return connectAndDestroy().then(function () {
//     return connectAndCreateAndClose();
//   }).catch(function () {
//     return connectAndCreateAndClose();
//   });

// };
// TMP - END


var Server = require('./server'),
  Process = require('./process');

var server = new Server(),
  process = new Process();

try { // TODO: remove
ensureDBCreated().then(function () { // TODO: remove this promise!
  process.run();
  server.listen();
});
} catch (err) {
console.log('main err=', err);
}