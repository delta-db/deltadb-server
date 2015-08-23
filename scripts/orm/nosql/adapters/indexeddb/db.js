'use strict';

/* global indexedDB */

// NOTE: we only use the index on the primary key -- in future support indexes (NEED MORE NOTES ON
// THIS!!)
// TODO: because of indexing complexity need one store per DB?

var Promise = require('bluebird'),
  inherits = require('inherits'),
  AbstractDB = require('../../db'),
  Collection = require('./collection');

var DB = function (dbName) {
  this._dbName = dbName;
};

inherits(DB, AbstractDB);

DB.prototype._open = function (name, version) {
  var self = this;
  return new Promise(function (resolve, reject) {
    var request = null;
    if (version) {
      request = indexedDB.open(self._dbName, version);
    } else {
      request = indexedDB.open(self._dbName);
    }

    request.onupgradeneeded = function () {
      // TODO: what about errors?? is there a db.onerror?
      var db = request.result;
      db.createObjStore(name, {
        keyPath: self._idName
      });
    };

    request.onsuccess = function () {
      self._db = request.result;
      // TODO: does the following work for all browsers? It works in Chrome and FF
      if (self._db.objStoreNames.length === 0) { // does the store need to be recreated?
        self.close().then(function () {
          // TODO: better promise design as could be error from close
          resolve(false);
        });
      } else {
        resolve(new Collection(self, name));
      }
    };

    request.onerror = function () {
      reject(request.error);
    };
  });
};

DB.prototype.col = function (name) {
  // First attempt to open the database, but if the store doesn't exist, which can happen if the
  // store was just destroyed, we need to close the database, reopen it with a version change and
  // then add the store. (The same process would be needed if we wanted to changed the indexes).
  var self = this;
  return self._open(name).then(function (collection) {
    if (collection === false) {
      return self._open(name, self._db.version + 1);
    } else {
      return collection;
    }
  });
};

DB.prototype.close = function () {
  var self = this;
  return new Promise(function (resolve) {
    // TODO: is close really synchronous???
    self._db.close();
    resolve();
  });
};

module.exports = DB;