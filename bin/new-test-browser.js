#!/usr/bin/env node

require('./new-dev-server');

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

var spawn = require('child_process').spawn;

var server = require('../test/browser-server');

server.start('browser-server.log', 'browser-client.log').then(function () {

  // Unless we have mocha-phantomjs installed globally we have to specify the full path
  // var child = spawn('mocha-phantomjs', [
  var child = spawn('./node_modules/mocha-phantomjs/bin/mocha-phantomjs', [
    'http://127.0.0.1:8001/test/new-index.html',
    '--timeout', '25000',
    '--hooks', 'test/phantom-hooks.js'
  ]);

  child.stdout.on('data', function(data) {
    console.log(data.toString()); // echo output, including what could be errors
  });

  child.on('close', function (code) {
    console.log('Mocha process exited with code ' + code);
    return server.stop().then(function () {
      if (code > 0) {
        process.exit(1);
      } else {
        process.exit(0);
      }
    });
  });

});
