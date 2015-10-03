'use strict';

// TODO: do something similar for archiving or expect user to schedule archiving w/ cron job,
// etc...?

var Partitioner = require('../partitioner/sql'),
  Promise = require('bluebird'),
  MemAdapter = require('../orm/nosql/adapters/mem'),
  Client = require('../client'),
  clientUtils = require('../client/utils');

var Process = function () {
  this._initSystemDB();
};

Process.SLEEP_MS = 1000;

// Use a client to connect to the System DB to load and track the creation/destruction of DBs
Process.prototype._initSystemDB = function () {
  var store = new MemAdapter();
  this._client = new Client(store);

  // TODO: doesn't url need to be set here?
  this._systemDB = this._client.db({ db: clientUtils.SYSTEM_DB_NAME });

  this._systemDB.on('attr:recorded', function (attr, doc) {
// TODO: we need this working
console.log('********attr:recorded, attr=', attr, 'doc=', doc)
  });
};

Process.prototype._process = function () {
  // TODO: use DeltaDB client to connect to $system and get list of DBs. Better to create a new
  // partitioner each loop so that can deal with many DBs or is this too inefficient?

// TODO: loop for system & all DBs

  var part = new Partitioner(clientUtils.SYSTEM_DB_NAME);
  return part.connect().then(function () {
    return part.process();
  }).then(function () {
    return part.closeDatabase();

// TMP - BEGIN
}).then(function () {
part = new Partitioner('mydb');
return part.connect().then(function () {
  return part.process();
}).then(function () {
  return part.closeDatabase();
}).catch(function () {
// Ignore error causes by mydb not being created yet
});
// TMP - END

  });  

// // TMP - BEGIN
// var part = new Partitioner('mydb');
// return part.connect().then(function () {
//   return part.process();
// }).then(function () {
//   return part.closeDatabase();
// });
// // TMP - END
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