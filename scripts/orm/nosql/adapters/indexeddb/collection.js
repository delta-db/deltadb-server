'use strict';

var Promise = require('bluebird'),
  inherits = require('inherits'),
  CommonCollection = require('../../common/collection'),
  FilterCursor = require('../../common/cursor/filter'), // TODO: rename to filter-cursor
  SortCursor = require('../../common/cursor/sort'), // TODO: rename to sort-cursor
  where = require('../../common/where'),
  order = require('../../common/order'),
  Doc = require('./doc'),
  Cursor = require('./cursor');

// TODO: change order so name then this to be standard with other adapters
var Collection = function (db, name) {
  this._db = db;
  this._name = name;
};

inherits(Collection, CommonCollection);

Collection.prototype.doc = function (obj) {
  return new Doc(obj, this);
};

Collection.prototype.get = function (id) {
  var self = this;
  return self._opened().then(function () {
    return new Promise(function (resolve, reject) {
      var tx = self._db._db.transaction(self._name, 'readwrite'),
        store = tx.objectStore(self._name),
        request = store.get(id);

      request.onsuccess = function () {
        resolve(request.result ? new Doc(request.result, self) : null);
      };

      // TODO: how to generate this error in unit testing? Even a get() with a bad key doesn't trigger
      // it.
      /* istanbul ignore next */
      request.onerror = function () {
        reject(request.error);
      };

      // TODO: do we also need tx.oncomplete and tx.onerror and if so can we use them instead of
      // request.onsuccess and request.onerror??
    });
  });
};

// TODO: it is far better to query and sort in IndexedDB based on indexes, but dealing with dynamic
// indexes is tricky and for a future release. http://stackoverflow.com/questions/6405650/how-do-i
// -query-using-multiple-conditions-in-indexeddb - but does this work in IE?
// http://stackoverflow.com/questions/12084177/in-indexeddb-is-there-a-way-to-make-a-sorted-
// compound-query . We may want to use one of these methods if ALL the attrs are indexed and
// then fall back to the SortCursor & FilterCursor approaches when any of the attrs are not
// indexed. 
Collection.prototype.find = function (query, callback) {
  var self = this;
  return new Promise(function (resolve, reject) {

    if (query) {
      if (typeof query.offset !== 'undefined') {
        // TODO: impl offset, can it default to method used by MemAdapter?
        throw new Error('offset not implemented');
      } else if (typeof query.limit !== 'undefined') {
        // TODO: impl limit, can it default to method used by MemAdapter?
        throw new Error('limit not implemented');
      }
    }

    var tx = self._db._db.transaction(self._name, 'readonly'),
      store = tx.objectStore(self._name),
      request = store.openCursor(),
      callbackWrapper = null;

    request.onsuccess = function () {
      // Appears that you cannot do resolve(filterCursor); and then use filterCursor.each later as
      // then the txn is not active, so we have to pass the callback into this fn directly!

      if (callbackWrapper === null) {
        callbackWrapper = {};
        var cursor = new Cursor(request.result, callbackWrapper, self),
          filter = query && query.where ? where.filter(query.where) : null,
          filterCursor = new FilterCursor(cursor, filter);
        if (query && query.order) {
          var sort = order.sort(query.order);
          var sortCursor = new SortCursor(filterCursor, sort);
          resolve(sortCursor.each(callback));
        } else {
          resolve(filterCursor.each(callback));
        }
      } else {
        callbackWrapper.callback(request.result);
      }
    };

    // TODO: how to generate this error in unit testing?
    /* istanbul ignore next */
    request.onerror = function () {
      reject(request.error);
    };
  });
};

Collection.prototype.destroy = function () {
  var self = this;
  return self._opened().then(function () {
    return self._db._destroyCol(self._name);
  });
};

Collection.prototype._open = function () {
  return this._db._openAndCreateObjectStoreWhenReady(this._name);
};

Collection.prototype._opened = function () {
  if (!this._openPromise) {
    this._openPromise = this._open();
  }
  return this._openPromise;
};

module.exports = Collection;