'use strict';

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
  config = require('../config');

var Server = function () {};

Server.prototype.spawn = function () {
  this._log = fs.createWriteStream('./test/server.log', {
    flags: 'w'
  });
  this._server = spawn('./bin/deltadb-server', [
    '--port', config.PORT,
    '--prefix', config.DB_NAME_PREFIX
  ]);
  this._server.stdout.pipe(this._log);
  this._server.stderr.pipe(this._log);
};

Server.prototype.kill = function () {
  this._server.kill();
};

module.exports = Server;
