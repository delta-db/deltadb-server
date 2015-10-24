'use strict';

var Promise = require('bluebird'),
  inherits = require('inherits'),
  CommonCollection = require('../../common/collection'),
  FilterCursor = require('../../common/cursor/filter'),
  SortCursor = require('../../common/cursor/sort'),
  where = require('../../common/where'),
  order = require('../../common/order'),
  Cursor = require('./cursor'),
  Doc = require('./doc'),
  utils = require('../../../../utils');

var Collection = function (name, db) {
  CommonCollection.apply(this, arguments); // apply parent constructor
  this._name = name;
  this._db = db;
  this._docs = {};
  this._pendingDocs = {}; // docs that have yet to be registered
};

inherits(Collection, CommonCollection);

Collection.prototype.doc = function (data) {
  var doc = new Doc(data, this);
  this._pendingDocs[doc._pendingID] = doc;
  return doc;
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
  delete this._pendingDocs[doc._pendingID]; // remove from list of pending docs
  return Promise.resolve();
};

Collection.prototype._unregister = function (doc) {
  delete this._docs[doc.id()];
  return Promise.resolve();
};

Collection.prototype._allPending = function (callback) {
  utils.each(this._pendingDocs, callback);
};

module.exports = Collection;
