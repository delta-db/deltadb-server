'use strict';

// TODO: do something similar for archiving or expect user to schedule archiving w/ cron job,
// etc...?

var Partitioner = require('../partitioner/sql'),
  Promise = require('bluebird'),
  MemAdapter = require('../orm/nosql/adapters/mem'),
  Client = require('../client'),
  clientUtils = require('../client/utils'),
  utils = require('../utils'),
  Promise = require('bluebird'),
  DBMissingError = require('../client/db-missing-error'),
  SocketClosedError = require('../orm/sql/common/socket-closed-error');

var Process = function () {
  this._initSystemDB();
  this._dbNames = { system: clientUtils.SYSTEM_DB_NAME };
};

Process.SLEEP_MS = 1000;

// TODO: split up
// Use a client to connect to the System DB to load and track the creation/destruction of DBs
Process.prototype._initSystemDB = function () {
  var self = this,
    store = new MemAdapter();

  self._client = new Client(store);

  // TODO: doesn't url need to be set here?
  self._systemDB = self._client.db({ db: clientUtils.SYSTEM_DB_NAME });

  self._dbs = self._systemDB.col(clientUtils.DB_COLLECTION_NAME);

  self._dbs.on('doc:create', function (doc) {
    var data = doc.get(), dbName = data[clientUtils.DB_ATTR_NAME];
// console.log('$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$');
// console.log('doc=', doc);
// console.log('$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$');
    if (dbName) { // new db? Ignore policy deltas
console.log('^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^');
console.log('doc:create, register', doc.id(), dbName);
console.log('^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^');
      self._dbNames[dbName] = dbName;
//      self._dbNames[doc.id()] = dbName; // register new db
    }
  });

  self._dbs.on('doc:destroy', function (doc) {
    var data = doc.get(), dbName = data[clientUtils.DB_ATTR_NAME];
    if (dbName) { // destroying db? Ignore policy deltas
console.log('^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^');
console.log('doc:destroy, unregister', doc.id(), 'dbName=', dbName, data);
console.log('^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^');
      delete self._dbNames[dbName];
//      delete self._dbNames[doc.id()]; // unregister db
    }
  });
};

Process.prototype._processAndCatch = function (part) {
  return part.process().catch(function (err) {
console.log('&&&&&&&&&&&&&&&&&&&&&&&&&Process.prototype._processAndCatch', (new Date()).toUTCString());
    return part.closeDatabase().then(function () {
      throw err;
    })
  });
};

Process.prototype._processDB = function (dbName) {
// TODO: when the bug occurs, why does $system stop getting processed?
console.log('&&&&&&&&&&&&&&&&&&&&&&&&&_processDB1', (new Date()).toUTCString(), ', dbName=', dbName);
  // Use DeltaDB client to connect to $system and get list of DBs. TODO: Best to create a new
  // partitioner each loop so that can deal with many DBs or is this too inefficient?

  var self = this, part = new Partitioner(dbName);
  return part.connect().then(function () {
console.log('&&&&&&&&&&&&&&&&&&&&&&&&&_processDB2', (new Date()).toUTCString(), ', dbName=', dbName);
// TODO: appears to sometimes get caught during next line!!
// part._sql._debug = true;
    return self._processAndCatch(part);
  }).then(function () {
// part._sql._debug = false;
console.log('&&&&&&&&&&&&&&&&&&&&&&&&&_processDB3', (new Date()).toUTCString(), ', dbName=', dbName);
    return part.closeDatabase();
  }).catch(function (err) {
console.log('&&&&&&&&&&&&&&&&&&&&&&&&&_processDB4, err=', err, err.stack);
    // Don't throw DBMissingError or SocketClosedError as the DB may have just been destroyed and
    // not yet removed from _dbNames.
    if (!(err instanceof DBMissingError) && !(err instanceof SocketClosedError)) {
console.log('&&&&&&&&&&&&&&&&&&&&&&&&&_processDB5, err=', err, err.stack);
process.exit(1);
      throw err;
    }
  });
};

Process.prototype._process = function () {
  var self = this, promises = [];
  utils.each(self._dbNames, function (dbName) {
    promises.push(self._processDB(dbName));
  });
  return Promise.all(promises);
};

Process.prototype._loop = function () {
// TODO: why is this not repeating???
console.log('Process.prototype._loop1', (new Date()).toUTCString());
  var self = this;
  self._process().then(function () {
console.log('Process.prototype._loop2', (new Date()).toUTCString());
    setTimeout(function () {
console.log('Process.prototype._loop3', (new Date()).toUTCString());
      self._loop();
    }, Process.SLEEP_MS);

}).catch(function (err) {
console.log('loop err=', err);


  });
};

Process.prototype.run = function () {
  this._loop();
};

module.exports = Process;
