'use strict';

// TODO: Could probably generalize the following for different types of wrappers

var inherits = require('inherits'),
  utils = require('../../../utils'),
  AbstractAdapter = require('../common/adapter');

var Adapter = function (adapter) {
  utils.wrapMissing(this, adapter);
  this._adapter = adapter;
};

inherits(Adapter, AbstractAdapter);

utils.wrapFunctions(Adapter, '_adapter');

module.exports = Adapter;