'use strict';

// TODO: do something similar for archiving or expect user to schedule archiving w/ cron job,
// etc...?

var Partitioner = require('../partitioner/sql'),
  Promise = require('bluebird'),
  Client = require('../client/adapter'),
  // Client = require('deltadb/scripts/adapter'),
  clientUtils = require('deltadb/scripts/utils'),
  commonUtils = require('deltadb-common-utils'),
  Promise = require('bluebird'),
  DBMissingError = require('deltadb-common-utils/scripts/errors/db-missing-error'),
  SocketClosedError = require('deltadb-orm-sql/scripts/common/socket-closed-error'),
  Users = require('../partitioner/sql/user/users');

var Process = function () {
  this._dbNames = {};

  this._partitioners = {};
};

/**
 * Milliseconds to sleep in between processing DBs so that we don't starve the CPU. In the future
 * we shouldn't need this as we'll receive an event when we should process.
 */
Process.SLEEP_MS = 500;

Process.prototype._createSystemDBCreateListener = function () {
  var self = this;
  self._dbs.on('doc:create', function (doc) {
    var data = doc.get(),
      dbName = data[clientUtils.DB_ATTR_NAME];
    if (dbName) { // new db? Ignore policy deltas
      self._dbNames[dbName] = dbName;
    }
  });
};

Process.prototype._createSystemDBDestroyListener = function () {
  var self = this;
  self._dbs.on('doc:destroy', function (doc) {
    var data = doc.get(),
      dbName = data[clientUtils.DB_ATTR_NAME];
    // if (dbName) { // destroying db? Ignore policy deltas
    delete self._dbNames[dbName];
    // }
  });
};

Process.prototype._newSystemDB = function (hashedPassword) {
  // TODO: doesn't url need to be set here?
  this._systemDB = this._client.db({
    db: clientUtils.SYSTEM_DB_NAME,

    // Receive all deltas don't filter for just deltas that originate from this client
    filter: false,

    // We need super user access so that we can guarantee that we will be monitoring all the DBs
    hashed: hashedPassword
  });
};

Process.prototype._superHashedPassword = function () {
  return this._partitioner(clientUtils.SYSTEM_DB_NAME).then(function (partitioner) {
    return partitioner._users.getUser(Users.ID_SUPER);
  }).then(function (user) {
    return user.password;
  });
};

// Use a client to connect to the System DB to load and track the creation/destruction of DBs
Process.prototype._initSystemDB = function () {
  var self = this;

  return self._superHashedPassword().then(function (hashedPassword) {

    self._client = new Client();

    self._newSystemDB(hashedPassword);

    self._dbs = self._systemDB.col(clientUtils.DB_COLLECTION_NAME);

    self._createSystemDBCreateListener();

    self._createSystemDBDestroyListener();

    // Register DB name for processing as we have finished initialization
    self._dbNames = {
      system: clientUtils.SYSTEM_DB_NAME
    };

    return null; // prevent runaway promise warning
  });
};

Process.prototype._processAndCatch = function (part) {
  var self = this;
  return part.process().catch(function (err) {
    if (err instanceof SocketClosedError) { // was the socket closed due to destroying a DB?
      // Remove partitioner from pool
      delete self._partitioners[part._dbName];

      return part.closeDatabase();
    } else {
      throw err;
    }
  });
};

Process.prototype._partitioner = function (dbName) {
  var self = this,
    promise = null;

  if (!self._partitioners[dbName]) { // not connected?
    self._partitioners[dbName] = new Partitioner(dbName);
    promise = self._partitioners[dbName].connect();
  } else {
    promise = Promise.resolve();
  }

  return promise.then(function () {
    //    return self._partitioners[dbName];
    var part = self._partitioners[dbName];
    return part;
  });
};

Process.prototype._processDB = function (dbName) {
  // TODO: if keep with partitioner pooling then what happens when we have many DBs?

  var self = this,
    part = null;
  return self._partitioner(dbName).then(function (_part) {
    part = _part;
    return self._processAndCatch(part);
  }).catch(function (err) {
    // Don't throw DBMissingError or SocketClosedError as the DB may have just been destroyed and
    // not yet removed from _dbNames.
    if (!(err instanceof DBMissingError) && !(err instanceof SocketClosedError)) {
      throw err;
    }
  });
};

Process.prototype._process = function () {
  var self = this,
    promises = [];
  commonUtils.each(self._dbNames, function (dbName) {
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
  // Init System DB here so that we don't have to do it in the constructor, which would make our
  // tests always create the System DB
  this._initSystemDB();

  this._loop();
};

Process.prototype.authenticated = function (dbName, username, password, hashedPassword) {
  // TODO: if decided to stick with partitioner pooling then what happens when there are many DBs?

  var self = this,
    part = null,
    user = null,
    err = null;

  return self._partitioner(dbName).then(function (_part) {
    part = _part;
    return part._users.authenticated(username, password, hashedPassword).then(function (_user) {
      user = _user;
    }).catch(function (_err) {
      err = _err;
    });
  }).then(function () {
    if (err) {
      throw err;
    } else {
      return user;
    }
  });
};

module.exports = Process;
