'use strict';

var Promise = require('bluebird'),
  inherits = require('inherits'),
  AbstractCollection = require('../../common/collection'),
  FilterCursor = require('../../common/cursor/filter'),
  SortCursor = require('../../common/cursor/sort'),
  where = require('../../common/where'),
  order = require('../../common/order'),
  Cursor = require('./cursor');

var Collection = function (provider, name, db) {
  this._provider = provider;
  this._name = name;
  this._db = db;
  this._items = {};
};

inherits(Collection, AbstractCollection);

Collection.prototype.define = function (doc) {
  var item = new this._provider.ItemWrapper(new this._provider.Item(doc, this));
  return item;
};

// TODO: rename to get? Or no, cause then implies there probably is a "put" method?
Collection.prototype.at = function (id) {
  return Promise.resolve(this._items[id]);
};

Collection.prototype.find = function (query) {
  var self = this;
  return new Promise(function (resolve) {
    var cursor = new Cursor(self._items, self),
      filter = query && query.where ? where.filter(query.where) : null,
      filterCursor = new FilterCursor(cursor, filter);
    if (query && query.order) {
      var sort = order.sort(query.order);
      resolve(new SortCursor(filterCursor, sort));
    } else {
      resolve(filterCursor);
    }
  });
};

Collection.prototype._getItem = function (id) {
  var item = this._items[id];
  return item;
};

Collection.prototype._register = function (item) {
  this._items[item.id()] = item;
  return Promise.resolve();
};

Collection.prototype._unregister = function (item) {
  delete this._items[item.id()];
  return Promise.resolve();
};

module.exports = Collection;