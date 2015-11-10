'use strict';

var Promise = require('bluebird'),
  inherits = require('inherits'),
  CommonDoc = require('../../common/doc');

var Doc = function (doc, col) {
  CommonDoc.apply(this, arguments); // apply parent constructor
  this._col = col;
  this._idName = col._db._idName;
};

inherits(Doc, CommonDoc);

Doc.prototype._putTransaction = function (doc) {
  var self = this;
  return new Promise(function (resolve, reject) {

    var tx = self._col._db._db.transaction(self._col._name, 'readwrite'),
      store = tx.objectStore(self._col._name);

    var request = store.put(doc);

    request.onsuccess = function () {
      resolve();
    };

    // TODO: how to test?
    /* istanbul ignore next */
    request.onerror = function () {
      reject(request.error);
    };

    // TODO: do we also need tx.oncomplete and tx.onerror and if so can we use them instead of
    // request.onsuccess and request.onerror??
  });
};

Doc.prototype._transaction = function (promiseFactory) {
  var self = this;
  return self._col._opened.then(function () { // col opened?
    return self._col._db._transaction(promiseFactory); // synchronize transaction
  });
};

Doc.prototype._put = function (doc) {
  var self = this;
  return self._transaction(function () { // synchronize transaction
    return self._putTransaction(doc);
  });
};

Doc.prototype._insert = function () {
  var self = this;
  return CommonDoc.prototype._insert.apply(self, arguments).then(function () {
    return self._put(self._data);
  });
};

Doc.prototype._update = function () {
  return this._put(this._data);
};

Doc.prototype._destroyTransaction = function () {
  var self = this;
  return new Promise(function (resolve, reject) {

    var tx = self._col._db._db.transaction(self._col._name, 'readwrite'),
      store = tx.objectStore(self._col._name);

    var request = store.delete(self.id());

    request.onsuccess = function () {
      resolve();
    };

    // TODO: to test as deleting a doc with an id that is missing doesn't execute noerror!
    /* istanbul ignore next */
    request.onerror = function () {
      reject(request.error);
    };
  });
};

Doc.prototype._destroy = function () {
  var self = this;
  return self._transaction(function () { // synchronize transaction
    return self._destroyTransaction();
  });
};

Doc.prototype._save = function () {
  var self = this,
    args = arguments;
  return self._col._opened.then(function () {
    return CommonDoc.prototype._save.apply(self, args);
  });
};

module.exports = Doc;
