'use strict';

var inherits = require('inherits'),
  AdapterWrapper = require('../orm/nosql/wrapper/adapter'),
  ClientDB = require('./db'),
  ClientCollection = require('./collection'),
  ClientItem = require('./item');

var Adapter = function (store) {
  AdapterWrapper.apply(this, arguments); // apply parent constructor
  this._provider = {
    DBWrapper: ClientDB,
    DB: store._provider.DB,
    CollectionWrapper: ClientCollection,
    Collection: store._provider.Collection,
    ItemWrapper: ClientItem,
    Item: store._provider.Item
  };
};

inherits(Adapter, AdapterWrapper);

Adapter.prototype._emit = function (event, attr, item) {
  this.emit(event, attr, item);
};

module.exports = Adapter;