'use strict';

var ForbiddenError = function (message) {
  this.name = 'ForbiddenError';
  this.message = message;

  // Get stack trace
  // TODO: generalize for all errors
  var err = new Error();
  this.stack = err.stack;
};

ForbiddenError.prototype = Object.create(Error.prototype);
ForbiddenError.prototype.constructor = ForbiddenError;

module.exports = ForbiddenError;
