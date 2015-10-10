'use strict';

var SQLError = require('./sql-error'),
  inherits = require('inherits');

var AddressNotFoundError = function (message) {
  this.name = 'AddressNotFoundError';
  this.message = message;
};

inherits(AddressNotFoundError, SQLError);

module.exports = AddressNotFoundError;
