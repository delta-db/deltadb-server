'use strict';

// TODO: best name? Better to call it Helpers? Utils is already taken
var Core = function () {};

Core.prototype.reserved = function (name) {
  return (name && name.length >= 1 && name.charAt(0) === '$') ? true : false;
};

module.exports = new Core();
