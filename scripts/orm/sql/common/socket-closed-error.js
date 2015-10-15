'use strict';

var SQLError = require('./sql-error'),
  inherits = require('inherits');

var SocketClosedError = function (message) {
  this.name = 'SocketClosedError';
  this.message = message;
};

inherits(SocketClosedError, SQLError);

module.exports = SocketClosedError;