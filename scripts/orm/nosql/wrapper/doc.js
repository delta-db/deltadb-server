'use strict';

// TODO: Create Wrapper a general purpose class that wraps?

var inherits = require('inherits'),
  utils = require('../../../utils'),
  AbstractDoc = require('../common/doc');

var Doc = function (doc) {
  utils.wrapMissing(this, doc);
  this._doc = doc;
};

inherits(Doc, AbstractDoc);

utils.wrapFunctions(Doc, '_doc');

module.exports = Doc;