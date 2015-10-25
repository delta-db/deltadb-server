'use strict';

// NOTE: we only use the index on the primary key -- in future support indexes (NEED MORE NOTES ON
// THIS!!)
// TODO: because of indexing complexity need one store per DB?

var Promise = require('bluebird'),
  inherits = require('inherits'),
  CommonDB = require('../../common/db'),
  Collection = require('./collection'),
  utils = require('../../../../utils'),
  idbUtils = require('./utils'),
  clientUtils = require('../../../../client/utils'),
  UtilsCollection = require('../../../../utils/collection');

if (global.window && !idbUtils.indexedDB()) { // in browser and no IndexedDB support?
  // Use a shim as phantomjs doesn't support indexedDB
  require('indexeddbshim'); // Automatically sets window.shimIndexedDB
}

/**
 * It appears that the IndexedDB spec takes some shortcuts. In order to create an object store, you
 * need to first close any open DB then re-open while triggering a DB upgrade. Therefore, you need
 * to worry about synchronizing transactions so that you are not executing a transaction while
 * opening/closing a DB or vise-versa. We'll handle this detail in this adapter so that the end user
 * doesn't have to.
 *
 * Synchronization:
 * - if closing then check to make sure there aren't any executing transactions
 * - before executing the transaction check to make sure we aren't closing. If we are closing then
 *   we need to wait until the reopen
 */
var DB = function () {
  CommonDB.apply(this, arguments); // apply parent constructor
  this._cols = {};
  this._pendingObjectStores = [];
  this._load();

  // Promise that guarantees that DB is open
  this._opened = utils.once(this, 'open');

  this._executingTransactions = new UtilsCollection(); // used for synchronizing transactions w/ open/closes
};

inherits(DB, CommonDB);

DB.prototype._setDB = function (request) {
  this._db = request.result;
};

// Package open as a promise so that we can consolidate code and provide a single place to test the
// error case
DB.prototype._open = function (onUpgradeNeeded, onSuccess) {
  var self = this;
  return new Promise(function (resolve, reject) {
    var request = null;
    if (self._version) {
      request = idbUtils.indexedDB().open(self._name, self._version);
    } else { // 1st time opening?
      request = idbUtils.indexedDB().open(self._name);
    }

    request.onupgradeneeded = function () {
      self._setDB(request);
      if (onUpgradeNeeded) {
        onUpgradeNeeded(request, resolve);
      }
    };

    request.onsuccess = function () {
      self._setDB(request);
      onSuccess(request, resolve);
      self._wasOpened = true;
      self.emit('open');
    };

    // TODO: how to test onerror as FF doesn't call onerror for VersionError?
    /* istanbul ignore next */
    request.onerror = function () {
      reject(request.error);
    };
  });
};

DB.prototype._initStore = function () {
  var self = this;
  return self._open(null, function (request, resolve) {
    self._version = parseInt(self._db.version);
    self.emit('load'); // store is loaded and ready
    resolve();
  });
};

DB.prototype._openAndCreateObjectStore = function (name) {
  var self = this;

  var onUpgradeNeeded = function (request) {
    self._db.createObjectStore(name, {
      keyPath: self._idName
    });
  };

  var onSuccess = function (request, resolve) {
    resolve();
  };

  // Close any existing connection. We cannot reopen until we close first
  return self.close().then(function () {
    self._version++; // Increment the version that we can add the object store
    return self._open(onUpgradeNeeded, onSuccess);
  });
};

DB.prototype._storeReady = function () {
  // We need to increment the version to fire an 'onupgradeneeded' event so that we can create a new
  // collection.
  if (!this._storePromise) { // not initialized?
    this._storePromise = this._initStore(); // Get the latest version stored in the DB
  }

  return this._storePromise;
};

DB.prototype._openAndCreateObjectStoreFactory = function (os) {
  var self = this;
  return function () {
    return self._openAndCreateObjectStore(os.name).then(function (col) {
      os.callback(null, col);
    }).catch(function (err) {
      os.callback(err);
    });
  };
};

DB.prototype._processPendingObjectStores = function () {
  var self = this;

  // Process pending object stores sequentially as the DB cannot be closed and opened
  // simulatenously. TODO: create all the missing stores at once.
  var chain = Promise.resolve();

  while (self._pendingObjectStores.length > 0) { // more items?
    var os = self._pendingObjectStores.shift();
    chain = chain.then(self._openAndCreateObjectStoreFactory(os));
  }

  return chain;
};

DB.prototype._startProcessingPendingObjectStores = function () {
  var self = this;

  // Already processing?
  if (self._processingPendingObjectStores) {
    return;
  }

  self._processingPendingObjectStores = true;

  // Done with processing?
  self._processPendingObjectStores().then(function () {
    // We more objects added since processing started?
    self._processingPendingObjectStores = false;
    if (self._pendingObjectStores.length > 0) {
      // Process again
      self._startProcessingPendingObjectStores();
    }
  });
};

// We need to close the DB and reopen it to create new objectStores. To prevent race conditions on
// the DB, we synchronize the objectStore creation by adding the request to a queue and then kicking
// off a function to process the queue. In the future, this code could be optimized by enhancing
// _openAndCreateObjectStore() to create all the queued stores at once.
DB.prototype._queueAndCreateObjectStore = function (name, callback) {
  this._pendingObjectStores.push({
    name: name,
    callback: callback
  });
  this._startProcessingPendingObjectStores();
};

DB.prototype._openAndCreateObjectStoreWhenReady = function (name) {
  var self = this,
    queueAndCreateObjectStore = utils.promisify(self._queueAndCreateObjectStore, self);
  return self._storeReady().then(function () {
    if (self._db.objectStoreNames.contains(name)) { // already exists?
      return Promise.resolve();
    } else {
      return queueAndCreateObjectStore(name);
    }
  });
};

DB.prototype.col = function (name) {
  if (this._cols[name]) { // exists?
    return this._cols[name];
  } else {
    var col = new Collection(this, name);
    this._cols[name] = col;
    return col;
  }
};

DB.prototype._close = function () {
  var self = this;
  return new Promise(function (resolve) {
    if (self._db) { // db already opened?
      self._db.close(); // Close is synchronous
    }
    self._wasOpened = false;
    self._opened = utils.once(self, 'open'); // Reset promise as DB now closed
    resolve();
  });
};

DB.prototype._closeWhenReady = function () {
  var self = this;

  if (!self._wasOpened) { // already closed?
    return Promise.resolve(); // just ignore close
  } else if (self._closing) { // already closing?
    return utils.once(self, 'close'); // wait to be notified
  }

  var promise = null;

  self._closing = true; // allow others to know that we are closing

  if (!self._executingTransactions.empty()) { // are any transactions being executed?
    // Wait to be notified that all transactions have completed
    promise = utils.once(self, 'transactions-done');
  } else {
    promise = Promise.resolve();
  }

  return promise.then(function () {
    return self._close(); // close the DB
  }).then(function () {
    self._closing = false; // just closed so no longer in the process of closing
    self.emit('close'); // alert everyone that we have closed
  });
};

DB.prototype.close = function () {
  var self = this;
  return self._storeReady().then(function () {
    return self._closeWhenReady();
  });
};

DB.prototype._executeTransaction = function (promiseFactory, id) {
  var self = this;

  return promiseFactory().then(function () {
    self._executingTransactions.remove(id); // unregister executing transaction

    // Trying to close and no more transactions?
    if (self._closing && self._executingTransactions.empty()) {
      self.emit('transactions-done'); // notify any ticks waiting to close
    }

    return arguments[0];
  });
};

/**
 * If the DB is closing then register the pending transaction and wait until it is reopened
 */
 DB.prototype._transaction = function (promiseFactory) {
   var self = this;

   // Make sure the DB is open
   return self._opened.then(function () {

     // We may just been told that the DB has been opened so we register the executing transaction
     // immediately and then execute it
     var id = self._executingTransactions.add(true); // register executing transaction

     return self._executeTransaction(promiseFactory, id);
   });
};

DB.prototype._destroy = function () {
  var self = this;
  return new Promise(function (resolve, reject) {
    var req = idbUtils.indexedDB().deleteDatabase(self._name);

    req.onsuccess = function () {
      resolve();
    };

    // TODO: how to trigger this for testing?
    /* istanbul ignore next */
    req.onerror = function () {
      reject(new Error("Couldn't destroy database: ") + req.err);
    };

    // TODO: how to trigger this for testing?
    /* istanbul ignore next */
    req.onblocked = function () {
      reject(new Error("Couldn't destroy database as blocked: " + req.err));
    };
  });
};

// !!!!!!!!!!
// TODO: why are there 2 opens happening? Shouldn't they be synchronized?
// TODO: destroying needs to do something similar to close with waiting as appears a race with another open will cause a problem!!
DB.prototype.destroy = function () {
  var self = this;
  // Make sure DB is loaded before destroying so there isn't a race condition where we try to
  // destroy the DB while opening it
  return self._storeReady().then(function () {
    // The DB must be closed before we destroy it
    return self.close();
  }).then(function () {
    return self._destroy();
  }).then(function () {
    return self._adapter._unregister(self._name);
  });
};

DB.prototype._destroyCol = function (colName) {
  // Handle the destroying at the DB layer as we need to first close and then reopen the DB before
  // destroying the col. Oh the joys of IDB!
  var self = this;

  var onUpgradeNeeded = function (request) {
    self._db.deleteObjectStore(colName);
  };

  var onSuccess = function (request, resolve) {
    resolve();
  };

  // Close will coordinate with any existing DB transactions and by the time it resolves there will
  // be a clear path to reopen the DB
  return self.close().then(function () { // Close any existing connection
    self._version++; // Increment the version so that we can trigger an onupgradeneeded
    return self._open(onUpgradeNeeded, onSuccess);
  });
};

DB.prototype.all = function (callback) {
  utils.each(this._cols, callback);
};

DB.prototype._load = function () {
  var self = this,
    promises = [];
  return self._storeReady().then(function () {
    utils.each(self._db.objectStoreNames, function (name, i) {
      // indexeddbshim creates a 'length' attr that should be ignored
      if (i !== 'length') {
        promises.push(self.col(name));
      }
    });
    return Promise.all(promises);
  });
};

module.exports = DB;
