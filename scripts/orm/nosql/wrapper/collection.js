'use strict';

var inherits = require('inherits'),
  utils = require('../../../utils'),
  AbstractCollection = require('../common/collection');

var Collection = function (collection) {
  utils.wrapMissing(this, collection);
  this._collection = collection;
};

inherits(Collection, AbstractCollection);

utils.wrapFunctions(Collection, '_collection');

module.exports = Collection;