'use strict';

var Cursor = function () {};

Cursor.prototype.array = function () {
  var self = this,
    docs = [];
  return self.each(function (doc) {
    docs.push(doc);
  }).then(function () {
    return docs;
  });
};

module.exports = Cursor;
