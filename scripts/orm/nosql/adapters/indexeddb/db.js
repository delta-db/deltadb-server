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
  this._pendingObjectStores = [];
};

inherits(DB, CommonDB);

DB.prototype._initStore = function () {
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

DB.prototype._createObjectStoreIfMissing = function (name) {
  if (this._db.objectStoreNames.contains(name)) { // exists?
    return Promise.resolve(new Collection(this, name));
  } else {
    return this._openAndCreateObjectStore(name);
  }
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
  if (!this._storePromise) { // not initialized?
    this._storePromise = this._initStore(); // Get the latest version stored in the DB
  }

  return this._storePromise;
};

DB.prototype._openAndCreateObjectStoreFactory = function (os) {
  var self = this;
  return function () {
    return self._createObjectStoreIfMissing(os.name).then(function (col) {
      os.callback(null, col);
    }).catch(function (err) {
      os.callback(err);
    });
  };
};

DB.prototype._processPendingObjectStores = function () {
  var self = this;
  if (!self._processingPendingObjectStores) {

    self._processingPendingObjectStores = true;
    var chain = Promise.resolve();
    
    while (self._pendingObjectStores.length > 0) { // more items?
      var os = self._pendingObjectStores.shift();
      chain = chain.then(self._openAndCreateObjectStoreFactory(os));
    }

    self._processingPendingObjectStores = false;
  }
};

// We need to close the DB and reopen it to create new objectStores. To prevent race conditions on
// the DB, we synchronize the objectStore creation by adding the request to a queue and then kicking
// off a function to process the queue. In the future, this code could be optimized by enhancing
// _openAndCreateObjectStore() to create all the queued stores at once.
DB.prototype._queueAndCreateObjectStore = function (name, callback) {
  this._pendingObjectStores.push({ name: name, callback: callback });
  this._processPendingObjectStores();
};

DB.prototype._openAndCreateObjectStoreWhenReady = function (name) {
  var self = this;
  return self._storeReady().then(function () {
    return new Promise(function (resolve, reject) {
      self._queueAndCreateObjectStore(name, function (err, col) {
        if (err) {
          reject(err);
        } else {
          resolve(col);
        }
      });
    });
  });
};

DB.prototype.col = function (name) {
  var self = this;
  if (self._collections[name]) { // exists?
    return Promise.resolve(self._collections[name]);
  } else {
    return self._openAndCreateObjectStoreWhenReady(name).then(function (col) {
      self._collections[name] = col;
      return col;
    });
  }
};

DB.prototype.close = function () {
  var self = this;
  return new Promise(function (resolve) {
    if (self._db) { // db already opened?
      self._db.close();
    }
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
  utils.each(this._collections, callback);
};

// Keeping this explicit instead of being called implicitly by all() so that a calling process can
// trigger the loading and determine when it has completed
DB.prototype._load = function () {
  var self = this, promises = [];
  return self._storeReady().then(function () {
    utils.each(self._db.objectStoreNames, function (name) {
      promises.push(self.col(name));
    });
    return Promise.all(promises);
  });
};

module.exports = DB;