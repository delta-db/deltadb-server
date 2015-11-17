'use strict';

var Promise = require('bluebird'),
  inherits = require('inherits'),
  CommonCollection = require('../../common/collection'),
  FilterCursor = require('../../common/cursor/filter'),
  SortCursor = require('../../common/cursor/sort'),
  where = require('../../common/where'),
  order = require('../../common/order'),
  Cursor = require('./cursor'),
  Doc = require('./doc');

var Collection = function (name, db) {
  CommonCollection.apply(this, arguments); // apply parent constructor
  this._name = name;
  this._db = db;
  this._docs = {};
};

inherits(Collection, CommonCollection);

Collection.prototype._doc = function (data) {
  return new Doc(data, this);
};

Collection.prototype.doc = function (data) {
  var id = data ? data[this._db._idName] : null;

  if (id && this._docs[id]) { // already registered?
    return this._docs[id];
  } else {
    var doc = this._doc(data);
    this._register(doc);
    return doc;
  }
};

Collection.prototype.get = function (id) {
  return Promise.resolve(this._docs[id] ? this._docs[id] : null);
};

// TODO: move to common
Collection.prototype._find = function (query, callback, cursor) {
  return new Promise(function (resolve) {
    var filter = query && query.where ? where.filter(query.where) : null,
      filterCursor = new FilterCursor(cursor, filter);
    if (query && query.order) {
      var sort = order.sort(query.order);
      var sortCursor = new SortCursor(filterCursor, sort);
      resolve(sortCursor.each(callback));
    } else {
      resolve(filterCursor.each(callback));
    }
  });
};

Collection.prototype.find = function (query, callback) {
  return this._find(query, callback, new Cursor(this._docs, this));
};

Collection.prototype._register = function (doc) {
  this._docs[doc.id()] = doc;
  return Promise.resolve();
};

Collection.prototype._unregister = function (doc) {
  delete this._docs[doc.id()];
  return Promise.resolve();
};

module.exports = Collection;
