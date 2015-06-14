'use strict';

// TODO: Create Wrapper a general purpose class that wraps?

var inherits = require('inherits'),
  utils = require('../../../utils'),
  AbstractItem = require('../common/item');

var Item = function (item) {
  utils.wrapMissing(this, item);
  this._item = item;
};

inherits(Item, AbstractItem);

utils.wrapFunctions(Item, '_item');

module.exports = Item;