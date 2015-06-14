'use strict';

var SQLError = require('./sql-error'),
  inherits = require('inherits');

var MissingError = function (message) {
  this.name = 'MissingError';
  this.message = message;
};

inherits(MissingError, SQLError);

module.exports = MissingError;