'use strict';

var Promise = require('bluebird'),
  inherits = require('inherits'),
  AbstractDB = require('../../db'),
  Collection = require('./collection'),
  CollectionWrapper = require('../../collection-wrapper');

var DB = function (db) {
  this._CollectionWrapper = CollectionWrapper;
  this._Collection = Collection;
  this._db = db;
};

inherits(DB, AbstractDB);

DB.prototype.col = function (name) {
  var self = this;
  return new Promise(function (resolve) {
    resolve(new CollectionWrapper(new Collection(self._db.col(name))));
  });
};

DB.prototype.close = function () {
  var self = this;
  // var close = Promise.promisify(self._db.close); // why isn't this working??
  // return close();
  return new Promise(function () {
    self._db.close();
  });
};

module.exports = DB;