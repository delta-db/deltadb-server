'use strict';

// TODO: do something similar for archiving or expect user to schedule archiving w/ cron job,
// etc...?

var Partitioner = require('../partitioner/sql');

var Process = function () {

};

Process.SLEEP_MS = 1000;

Process.prototype._process = function () {
  // TODO: use DeltaDB client to connect to $system and get list of DBs. Better to create a new
  // partitioner each loop so that can deal with many DBs or is this too inefficient?
  
// TMP - BEGIN
  var part = new Partitioner('mydb');
  return part.connect().then(function () {
    return part.process();
  }).then(function () {
    return part.closeDatabase();
  });
// TMP - END
};

Process.prototype._loop = function () {
  var self = this;
  self._process().then(function () {
    setTimeout(function () {
      self._loop();
    }, Process.SLEEP_MS);
  });
};

Process.prototype.run = function () {
  this._loop();
};

module.exports = Process;