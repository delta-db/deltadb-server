'use strict';

var ForbiddenError = function (message) {
  this.name = 'ForbiddenError';
  this.message = message;
};

ForbiddenError.prototype = Object.create(Error.prototype);
ForbiddenError.prototype.constructor = ForbiddenError;

module.exports = ForbiddenError;