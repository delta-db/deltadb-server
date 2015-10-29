'use strict';

// Provides a mechanism for checking for IndexedDB support without including any IndexedDB dependent
// code

var Utils = function () {};

Utils.prototype.indexedDB = function () {
  // TODO: fake window.indexedDB, etc... and remove the ignore statement below
  /* istanbul ignore next */
  return window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB ||
    window.shimIndexedDB;
};

module.exports = new Utils();
