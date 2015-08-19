'use strict';

var Promise = require('bluebird'),
  inherits = require('inherits'),
  AbstractCollection = require('../../collection'),
  Item = require('./item'),
  Cursor = require('./cursor'),
  where = require('./where');

var Collection = function (collection) {
  this._collection = collection;
};

inherits(Collection, AbstractCollection);

Collection.prototype.doc = function (obj) {
  return new Item(obj, this);
};

Collection.prototype.at = function (id) {
  var self = this;
  return new Promise(function (resolve, reject) {
    self._collection.findOne({
      _id: id
    }, function (err, doc) {
      if (err) {
        reject(err);
      } else {
        resolve(self.doc(doc));
      }
    });
  });
};

// e.g. [['age', 'asc'], ['name', 'desc']] or ['age', 'asc']
var toMongoOrder = function (order) {
  if (!Array.isArray(order)) {
    throw new Error('order must be an array');
  }
  var mongoOrder = {};
  if (!Array.isArray(order[0])) { // e.g. ['age', 'asc']
    order = [order];
  }
  order.forEach(function (item) {
    mongoOrder[item[0]] = item[1] === 'desc' ? -1 : 1;
  });
  return mongoOrder;
};

var toMongoQuery = function (query) {
  if (typeof query === 'undefined') {
    return {
      query: {},
      options: {}
    };
  }

  var opts = {};

  var mongoQuery = {};
  if (query.where) {
    where.addCriteria(query.where, mongoQuery);
  }

  if (query.order) {
    opts.sort = toMongoOrder(query.order);
  }

  if (query.limit) {
    opts.limit = query.limit;
  }

  if (query.offset) {
    opts.skip = query.offset;
  }

  return {
    query: mongoQuery,
    options: opts
  };
};

Collection.prototype.find = function (query) {
  var self = this;
  return new Promise(function (resolve, reject) {
    var mongoQuery = toMongoQuery(query);
    self._collection.find(mongoQuery.query, mongoQuery.options, function (err, cursor) {
      if (err) {
        reject(err);
      } else {
        resolve(new Cursor(cursor, self));
      }
    });
  });
};

module.exports = Collection;