'use strict';

var utils = require('../../../utils'),
  EventEmitter = require('events').EventEmitter,
  inherits = require('inherits');

var Collection = function (name, db) {
  EventEmitter.apply(this, arguments); // apply parent constructor
  this._name = name;
  this._db = db;
};

inherits(Collection, EventEmitter);

// Collection.prototype.doc = function (data) {
//   return new Doc(data, this);
// };

// Collection.prototype.get = function ( /* id */ ) {};

// Collection.prototype.find = function ( /* query */ ) {};

Collection.prototype.all = function (callback) {
  return this.find(null, callback);
};

// Collection.prototype.order = function ( /* criteria */ ) {};

Collection.prototype.destroy = utils.resolveFactory();

Collection.prototype._register = utils.resolveFactory();

Collection.prototype._unregister = utils.resolveFactory();

module.exports = Collection;
