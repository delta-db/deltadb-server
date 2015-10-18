'use strict';

var Promise = require('bluebird'),
  inherits = require('inherits'),
  AbstractCollection = require('../../collection'),
  Doc = require('./doc'),
  Cursor = require('./cursor'),
  where = require('./where');

var Collection = function (col) {
  this._col = col;
};

inherits(Collection, AbstractCollection);

Collection.prototype.doc = function (obj) {
  return new Doc(obj, this);
};

Collection.prototype.get = function (id) {
  var self = this;
  return new Promise(function (resolve, reject) {
    self._col.findOne({
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
  order.forEach(function (doc) {
    mongoOrder[doc[0]] = doc[1] === 'desc' ? -1 : 1;
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
    self._col.find(mongoQuery.query, mongoQuery.options, function (err, cursor) {
      if (err) {
        reject(err);
      } else {
        resolve(new Cursor(cursor, self));
      }
    });
  });
};

module.exports = Collection;
