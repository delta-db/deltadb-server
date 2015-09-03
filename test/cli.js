#!/usr/bin/env node

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

var child = spawn('mocha-phantomjs', [
  // 'http://127.0.0.1:8001/test/index.html',
  'http://127.0.0.1:8001/test/tmp.html',
  '--timeout', '25000',
  '--hooks', 'test/phantom_hooks.js'
]);

child.on('close', function (code) {
  console.log('Mocha process exited with code ' + code);
  if (code > 0) {
    process.exit(1);
  }
});