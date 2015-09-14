'use strict';

var Promise = require('bluebird'),
  inherits = require('inherits'),
  CommonDoc = require('../../common/doc');

var Doc = function (doc, collection) {
  CommonDoc.apply(this, arguments); // apply parent constructor
  this._collection = collection;
  this._idName = collection._db._idName;
};

inherits(Doc, CommonDoc);

Doc.prototype._put = function (doc) {
  var self = this;
  return new Promise(function (resolve, reject) {
    var tx = self._collection._db._db.transaction(self._collection._name, 'readwrite'),
      store = tx.objectStore(self._collection._name);

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

Doc.prototype._insert = function () {
  var self = this;
  return CommonDoc.prototype._insert.apply(self, arguments).then(function () {
    return self._put(self._data);
  });
};

Doc.prototype._update = function () {
  return this._put(this._data);
};

Doc.prototype._save = function () {
  var self = this,
    promise = self.id() ? self._update() : self._insert();
  return promise.then(function () {
    self.clean();
  });
};

Doc.prototype._destroy = function () {
  var self = this;
  return new Promise(function (resolve, reject) {
    var tx = self._collection._db._db.transaction(self._collection._name, 'readwrite'),
      store = tx.objectStore(self._collection._name);

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

module.exports = Doc;