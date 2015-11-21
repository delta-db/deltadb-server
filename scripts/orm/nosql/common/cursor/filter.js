'use strict';

var inherits = require('inherits'),
  Cursor = require('./index');

// FUTURE: could add offset and limit. Might not be best design however

var FilterCursor = function (cursor, filter) {
  this._cursor = cursor;
  this._filter = filter;
};

inherits(FilterCursor, Cursor);

FilterCursor.prototype.each = function (callback) {
  var self = this;
  if (self._filter) {
    return self._cursor.each(function (doc) {
      self._filter(doc.get());

      // Return value so that each loop can be ended early
      return callback(doc);
    });
  } else {
    return self._cursor.each(callback);
  }
};

module.exports = FilterCursor;
