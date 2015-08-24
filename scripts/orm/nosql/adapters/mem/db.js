'use strict';

var Promise = require('bluebird'),
  inherits = require('inherits'),
  CommonDB = require('../../common/db'),
  Collection = require('./collection');

var DB = function ( /* name, adapter */ ) {
  CommonDB.apply(this, arguments); // apply parent constructor
  this._idName = '$id'; // TODO: should every idName be moved to the DB layer?
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

DB.prototype.close = function () {
  return Promise.resolve();
};

module.exports = DB;