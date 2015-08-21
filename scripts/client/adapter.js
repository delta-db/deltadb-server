'use strict';

var inherits = require('inherits'),
  AdapterWrapper = require('../orm/nosql/wrapper/adapter'),
  ClientDB = require('./db'),
  ClientCollection = require('./collection'),
  ClientDoc = require('./item'),
  utils = require('../utils');

var Adapter = function (store) {
  AdapterWrapper.apply(this, arguments); // apply parent constructor
  this._provider = {
    DBWrapper: ClientDB,
    DB: store._provider.DB,
    CollectionWrapper: ClientCollection,
    Collection: store._provider.Collection,
    DocWrapper: ClientDoc,
    Doc: store._provider.Doc
  };
};

inherits(Adapter, AdapterWrapper);

Adapter.prototype._emit = function () { // event, arg1, ... argN
  this.emit.apply(this, utils.toArgsArray(arguments));
};

Adapter.prototype.uuid = function () {
  return utils.uuid();
};

module.exports = Adapter;