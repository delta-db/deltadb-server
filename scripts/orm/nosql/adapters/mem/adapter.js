'use strict';

var Promise = require('bluebird'),
  inherits = require('inherits'),
  AbstractAdapter = require('../../common/adapter'),
  DB = require('./db'),
  DBWrapper = require('../../wrapper/db'),
  Collection = require('./collection'),
  CollectionWrapper = require('../../wrapper/collection'),
  Item = require('./item'),
  ItemWrapper = require('../../wrapper/item');

var Adapter = function () {
  this._provider = {
    DBWrapper: DBWrapper,
    DB: DB,
    CollectionWrapper: CollectionWrapper,
    Collection: Collection,
    ItemWrapper: ItemWrapper,
    Item: Item
  };
};

inherits(Adapter, AbstractAdapter);

// opts: db
Adapter.prototype.connect = function (opts) {
  var self = this;
  return new Promise(function (resolve) {
    resolve(new self._provider.DBWrapper(new self._provider.DB(self._provider, opts.db, self)));
  });
};

module.exports = Adapter;