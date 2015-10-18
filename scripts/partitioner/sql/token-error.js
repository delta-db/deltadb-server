'use strict';

var DeltaError = require('./delta-error'),
  inherits = require('inherits');

var TokenError = function (message) {
  this.name = 'TokenError';
  this.message = message;
};

inherits(TokenError, DeltaError);

module.exports = TokenError;
