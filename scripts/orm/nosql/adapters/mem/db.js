'use strict';

var Promise = require('bluebird'),
  inherits = require('inherits'),
  CommonDB = require('../../common/db'),
  Collection = require('./collection'),
  utils = require('../../../../utils');

var DB = function ( /* name, adapter */ ) {
  CommonDB.apply(this, arguments); // apply parent constructor
  this._collections = {};
};

inherits(DB, CommonDB);

DB.prototype.col = function (name) {
  var self = this;
  return new Promise(function (resolve) {
    if (self._collections[name]) {
      resolve(self._collections[name]);
    } else {
      var collection = new Collection(name, self);
      self._collections[name] = collection;
      resolve(collection);
    }
  });
};

// TODO: should this return a promise like col.all()??
DB.prototype.all = function (callback) {
  utils.each(this._collections, callback);
};

DB.prototype.close = function () {
  return Promise.resolve();
};

module.exports = DB;