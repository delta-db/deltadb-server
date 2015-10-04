'use strict';

// TODO: do something similar for archiving or expect user to schedule archiving w/ cron job,
// etc...?

var Partitioner = require('../partitioner/sql'),
  Promise = require('bluebird'),
  MemAdapter = require('../orm/nosql/adapters/mem'),
  Client = require('../client'),
  clientUtils = require('../client/utils'),
  utils = require('../utils'),
  Promise = require('bluebird');

var Process = function () {
  this._initSystemDB();
  this._dbNames = { system: clientUtils.SYSTEM_DB_NAME };
};

Process.SLEEP_MS = 1000;

// Use a client to connect to the System DB to load and track the creation/destruction of DBs
Process.prototype._initSystemDB = function () {
  var self = this,
    store = new MemAdapter();
  
  self._client = new Client(store);

  // TODO: doesn't url need to be set here?
  self._systemDB = self._client.db({ db: clientUtils.SYSTEM_DB_NAME });

  self._dbs = self._systemDB.col(clientUtils.DB_COLLECTION_NAME);

  self._dbs.on('attr:record', function (attr, doc) {
    if (attr.name === clientUtils.DB_ATTR_NAME) { // db destroyed/created?
      if (attr.value === null) { // db destroyed?
        delete self._dbNames[doc.id()];
      } else {
        self._dbNames[doc.id()] = attr.value;
      }
    }
  });
};

Process.prototype._processDB = function (dbName) {
  // TODO: use DeltaDB client to connect to $system and get list of DBs. Better to create a new
  // partitioner each loop so that can deal with many DBs or is this too inefficient?

  var part = new Partitioner(dbName);
  return part.connect().then(function () {
    return part.process();
  }).then(function () {
    return part.closeDatabase();
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