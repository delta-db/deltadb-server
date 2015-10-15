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

var spawn = require('child_process').spawn;

var child = spawn('./bin/deltadb-server', [
  // 'http://127.0.0.1:8001/test/new-index.html',
  // '--timeout', '25000',
  // '--hooks', 'test/phantom-hooks.js'
]);

child.stdout.on('data', function(data) {
  console.log(data.toString()); // echo output, including what could be errors
});

child.on('close', function (code) {
  console.log('Server process exited with code ' + code);
  if (code > 0) {
    process.exit(1);
  } else {
  	process.exit(0);
  }
});

setTimeout(function () {
  console.log('killing');
  child.kill();
}, 10000);
