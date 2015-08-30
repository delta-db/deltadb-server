'use strict';

/* global indexedDB */

// NOTE: we only use the index on the primary key -- in future support indexes (NEED MORE NOTES ON
// THIS!!)
// TODO: because of indexing complexity need one store per DB?

// TODO: need to use something like the following?
// window.indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB ||
//   window.msIndexedDB;

var Promise = require('bluebird'),
  inherits = require('inherits'),
  CommonDB = require('../../common/db'),
  Collection = require('./collection'),
  utils = require('../../../../utils');

var DB = function () {
  CommonDB.apply(this, arguments); // apply parent constructor
  this._collections = {};
};

inherits(DB, CommonDB);

DB.prototype._initStore = function (name) {
  var self = this;
  return new Promise(function (resolve, reject) {
    var request = indexedDB.open(self._name);

    request.onupgradeneeded = function () {
      // Do nothing as we are just looking up the version and will change the schema later
    };

    request.onsuccess = function () {
      self._db = request.result;
      self._version = parseInt(self._db.version);
      resolve();
    };

    request.onerror = function () {
      reject(request.error);
    };
  });
};

DB.prototype._openAndCreateObjectStore = function (name) {
  var self = this;
  return new Promise(function (resolve, reject) {
    self._db.close(); // Close any existing connection

    self._version++; // Increment the version that we can add the object store

    var request = indexedDB.open(self._name, self._version);

    request.onupgradeneeded = function () {
      var db = request.result;
      if (!db.objectStoreNames.contains(name)) { // doesn't exist? 
        db.createObjectStore(name, {
          keyPath: self._idName
        });
      }
    };

    request.onsuccess = function () {
      self._db = request.result;
      resolve(new Collection(self, name));
    };

    request.onerror = function () {
      reject(request.error);
    };
  });
};

DB.prototype._storeReady = function () {
  // We need to increment the version to fire an 'onupgradeneeded' event to create a new collection. 
  if (this._version) { // already loaded
    return Promise.resolve();
  } else {
    return this._initStore(); // Get the latest version stored in the DB
  }
};

DB.prototype.col = function (name) {
  var self = this;
  if (self._collections[name]) { // exists?
    return Promise.resolve(self._collections[name]);
  } else {
    return self._storeReady().then(function () {
      return self._openAndCreateObjectStore(name);
    }).then(function (col) {
      self._collections[name] = col;
      return col;
    });
  }
};

DB.prototype.close = function () {
  var self = this;
  return new Promise(function (resolve) {
    // TODO: is close really synchronous???
    self._db.close();
    resolve();
  });
};

// TODO: unregister from adapter
DB.prototype.destroy = function () {
  var self = this;
  return new Promise(function (resolve, reject) {
    var req = indexedDB.deleteDatabase(self._name);

    req.onsuccess = function () {
      resolve();
    };

    req.onerror = function () {
      reject("Couldn't destroy database: " + req.err);
    };
    
    req.onblocked = function () {
      reject("Couldn't destroy database as blocked: " + req.err);
    };
  });
};

DB.prototype.all = function (callback) {
  var self = this;
  return self._open().then(function () {
console.log('objectStoreNames=', self._db.objectStoreNames);
//    if (self._db.objectStoreNames)
  });
};

DB.prototype._load = function () {
  var self = this, promises = [];
  return self._storeReady().then(function () {
    utils.each(self._db.objectStoreNames, function (name) {
      var promise = self.col(name).then(function (col) {
        col._load();
      });
      promises.push(promise);
    });
    return Promise.all(promises);
  });
};

module.exports = DB;