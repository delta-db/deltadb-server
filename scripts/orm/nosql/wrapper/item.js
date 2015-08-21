'use strict';

// TODO: Create Wrapper a general purpose class that wraps?

var inherits = require('inherits'),
  utils = require('../../../utils'),
  AbstractDoc = require('../common/item');

var Doc = function (item) {
  utils.wrapMissing(this, item);
  this._item = item;
};

inherits(Doc, AbstractDoc);

utils.wrapFunctions(Doc, '_item');

module.exports = Doc;