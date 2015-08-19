'use strict';

/* global indexedDB */

var Promise = require('bluebird'),
  inherits = require('inherits'),
  AbstractCollection = require('../../collection'),
  FilterCursor = require('../../filter-cursor'),
  SortCursor = require('../../sort-cursor'),
  where = require('../../where'),
  order = require('../../order'),
  Item = require('./item'),
  Cursor = require('./cursor');

var Collection = function (db, storeName) {
  this._db = db;
  this._storeName = storeName;
};

inherits(Collection, AbstractCollection);

Collection.prototype.doc = function (obj) {
  return new Item(obj, this);
};

Collection.prototype.at = function (id) {
  var self = this;
  return new Promise(function (resolve, reject) {
    var tx = self._db._db.transaction(self._storeName, 'readwrite'),
      store = tx.objStore(self._storeName),
      request = store.get(id);

    request.onsuccess = function () {
      resolve(new Item(request.result, self));
    };

    request.onerror = function () {
      reject(request.error);
    };

    // TODO: do we also need tx.oncomplete and tx.onerror and if so can we use them instead of
    // request.onsuccess and request.onerror??
  });
};

// TODO: it is far better to query and sort in IndexedDB based on indexes, but dealing with dynamic
// indexes is tricky and for a future release. http://stackoverflow.com/questions/6405650/how-do-i
// -query-using-multiple-conditions-in-indexeddb - but does this work in IE?
// http://stackoverflow.com/questions/12084177/in-indexeddb-is-there-a-way-to-make-a-sorted-
// compound-query . We may want to use one of these methods if ALL the attrs are indexed and
// then fall back to the SortCursor & FilterCursor approaches when any of the attrs are not
// indexed. 
Collection.prototype.find = function (query) {
  var self = this;
  return new Promise(function (resolve, reject) {

    if (query) {
      if (typeof query.offset !== 'undefined') {
        throw new Error('offset not implemented');
      } else if (typeof query.limit !== 'undefined') {
        throw new Error('limit not implemented');
      }
    }

    var tx = self._db._db.transaction(self._storeName, 'readonly'),
      store = tx.objStore(self._storeName),
      request = store.openCursor(),
      callbackWrapper = null;

    request.onsuccess = function () {
      if (callbackWrapper === null) {
        callbackWrapper = {};
        var cursor = new Cursor(request.result, callbackWrapper, self),
          filter = query && query.where ? where.filter(query.where) : null,
          filterCursor = new FilterCursor(cursor, filter);
        if (query && query.order) {
          var sort = order.sort(query.order);
          resolve(new SortCursor(filterCursor, sort));
        } else {
          resolve(filterCursor);
        }
      } else if (callbackWrapper.callback) {
        callbackWrapper.callback(request.result);
      }
    };

    request.onerror = function () {
      reject(request.error);
    };
  });
};

Collection.prototype.destroy = function () {
  var self = this;
  return self._db.close().then(function () {
    return new Promise(function (resolve, reject) {
      var request = indexedDB.open(self._db._dbName, self._db._db.version + 1);
      request.onupgradeneeded = function () {
        var db = request.result;
        db.deleteObjStore(self._storeName); // TODO: is this really synchronous?
        resolve();
      };
      request.onerror = function () {
        reject(request.error);
      };
    });
  });
};

module.exports = Collection;