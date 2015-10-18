'use strict';

var SQLError = function (message) {
  this.name = 'SQLError';
  this.message = message;
};

SQLError.prototype = Object.create(Error.prototype);
SQLError.prototype.constructor = SQLError;

module.exports = SQLError;
