'use strict';

// TODO: merge into utils.js or keep separate?

var Utils = function () {};

// The order of the attributes appears to be an issue of concern in browsers so we cannot just
// use .eql(). TODO: is there a better way, native to chai?
Utils.prototype.eql = function (exp, act) {
  var self = this,
    empty = true,
    isString = typeof exp === 'string';
  if (!isString) {
    for (var i in exp) {
      if (exp.hasOwnProperty(i)) {
        empty = false;
        if (typeof act[i] === 'undefined') {
          act.should.eql(exp);
        } else {
          self.eql(exp[i], act[i]);
        }
      }
    }
  }
  if (isString || empty) {
    act.should.eql(exp);
  }
};

Utils.prototype.findDocs = function (col, query) {
  var docs = {};
  return col.find(query, function (doc) {
    docs[doc.id()] = doc.get();
  }).then(function () {
    return docs;
  });
};

Utils.prototype.allDocs = function (col) {
  return this.findDocs(col);
};

Utils.prototype.indexDocs = function (docArray) {
  // Repackage as obj for eql()
  var indexedDocs = {};
  docArray.forEach(function (doc) {
    indexedDocs[doc.$id] = doc;
  });
  return indexedDocs;
};

Utils.prototype.findShouldEql = function (expDocArray, col, query) {
  var self = this;
  return self.findDocs(col, query).then(function (actAllDocs) {
    var expIndexedDocs = self.indexDocs(expDocArray);
    self.eql(expIndexedDocs, actAllDocs);
  });
};

Utils.prototype.allShouldEql = function (expDocArray, col) {
  return this.findShouldEql(expDocArray, col);
};

module.exports = new Utils();
