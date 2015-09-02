'use strict';

var Promise = require('bluebird'),
  inherits = require('inherits'),
  CommonCollection = require('../../common/collection'),
  FilterCursor = require('../../common/cursor/filter'), // TODO: rename to filter-cursor
  SortCursor = require('../../common/cursor/sort'), // TODO: rename to sort-cursor
  where = require('../../common/where'),
  order = require('../../common/order'),
  Doc = require('./doc'),
  DB = require('./db'),
  Cursor = require('./cursor');

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
  return new Promise(function (resolve, reject) {
    var tx = self._db._db.transaction(self._name, 'readwrite'),
      store = tx.objectStore(self._name),
      request = store.get(id);

    request.onsuccess = function () {
      resolve(request.result ? new Doc(request.result, self) : null);
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

    var tx = self._db._db.transaction(self._name, 'readonly'),
      store = tx.objectStore(self._name),
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
console.log('before each');
filterCursor.each(function (item) {
console.log('item=', item);
});
console.log('after each');
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

// TODO: have to refactor find and all to use callback directly? Appears so!!
// OR, do it the pouchdb way and buffer all docs into mem? Isn't that a waste though??
Collection.prototype.tmpFind = function (query, callback) {
  var self = this;
  return new Promise(function (resolve, reject) {

    if (query) {
      if (typeof query.offset !== 'undefined') {
        throw new Error('offset not implemented');
      } else if (typeof query.limit !== 'undefined') {
        throw new Error('limit not implemented');
      }
    }

    var tx = self._db._db.transaction(self._name, 'readonly'),
      store = tx.objectStore(self._name),
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
// TODO: update for new find
          resolve(new SortCursor(filterCursor, sort));
        } else {
          filterCursor.each(callback);
          // Appears that you cannot do resolve(filterCursor); and then use filterCursor.each later
          // as then the txn is not active, so we have to pass the callback into this fn directly!
          resolve();
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
      var request = DB.indexedDB().open(self._db._name, self._db._db.version + 1);
      request.onupgradeneeded = function () {
        var db = request.result;
        db.deleteObjStore(self._name); // TODO: is this really synchronous?
        resolve();
      };
      request.onerror = function () {
        reject(request.error);
      };
    });
  });
};

// Collection.prototype._load = function () {
// console.log('_load');
//   var self = this;
//   return self.all().then(function (docs) {
//     docs.each(function (doc) {
// console.log('doc=', doc, doc.get());
//     });
//   });
// };

module.exports = Collection;