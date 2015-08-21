'use strict';

var inherits = require('inherits'),
  AbstractAdapter = require('../../common/adapter'),
  DB = require('./db'),
  DBWrapper = require('../../wrapper/db'),
  Collection = require('./collection'),
  CollectionWrapper = require('../../wrapper/collection'),
  Doc = require('./doc'),
  DocWrapper = require('../../wrapper/doc');

var Adapter = function () {
  this._provider = {
    DBWrapper: DBWrapper,
    DB: DB,
    CollectionWrapper: CollectionWrapper,
    Collection: Collection,
    DocWrapper: DocWrapper,
    Doc: Doc
  };
};

inherits(Adapter, AbstractAdapter);

// TODO: shouldn't this be moved to the layer above?
// opts: db
Adapter.prototype.db = function (opts) {
  var db = new this._provider.DBWrapper(new this._provider.DB(this._provider, opts.db, this));
  this.emit('db:create', db);
  return db;
};

module.exports = Adapter;