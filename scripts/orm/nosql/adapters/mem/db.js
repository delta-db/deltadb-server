'use strict';

var Promise = require('bluebird'),
  inherits = require('inherits'),
  CommonDB = require('../../common/db'),
  Collection = require('./collection');

var DB = function ( /* name, adapter */ ) {
  CommonDB.apply(this, arguments); // apply parent constructor
  this._idName = '$id'; // TODO: should every idName be moved to the DB layer?
  this._db = this; // allow a wrapping DB to be pased down to the wrapping doc. TODO: remove??
  this._collections = {};
};

inherits(DB, CommonDB);

DB.prototype.col = function (name) {
  var self = this;
  return new Promise(function (resolve) {
    if (self._collections[name]) {
      resolve(self._collections[name]);
    } else {
      var collection = new Collection(name, self._db); // TODO: remove self._db? And from Coll?
      self._collections[name] = collection;
      resolve(collection);
    }
  });
};

DB.prototype.close = function () {
  return Promise.resolve();
};

module.exports = DB;