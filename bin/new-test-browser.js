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

var spawn = require('child_process').spawn,
  server = require('../test/browser-server'),
  utils = require('../test/utils');

server.start('browser-server.log').then(function () {

  // Give server time to start listening to prevent socket.io from displaying errors
  return utils.timeout(2000);

}).then(function () {

  var options = [
    'http://127.0.0.1:8001/test/new-index.html',
    '--timeout', '25000',
    '--hooks', 'test/phantom-hooks.js'
  ];

  if (process.env.GREP) {
    options.push('-g');
    options.push(process.env.GREP);
  }

  // Unless we have mocha-phantomjs installed globally we have to specify the full path
  // var child = spawn('mocha-phantomjs', options);
  var child = spawn('./node_modules/mocha-phantomjs/bin/mocha-phantomjs', options);

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
