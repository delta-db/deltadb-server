'use strict';

var utils = require('../scripts/utils');

var Utils = function () {};

Utils.prototype.never = function (msg) {
  throw new Error(utils.notDefined(msg) ? 'must never execute' : msg);
};

// If err.message is falsy then only ensures that both errors are of the same type
Utils.prototype.shouldThrow = function (fun, err) {
  var self = this;
  return fun().then(function () {
    self.never();
  }).catch(function (_err) {
    if (_err.message === 'must never execute') { // TODO: define & use NeverException instead
      throw new Error("didn't throw err");
    }

    if (err) {
      if (err.message) {
        err.message.should.eql(_err.message);
      }

      err.name.should.eql(_err.name);
    } else {
      (_err === null).should.eql(false);
    }
  });
};

module.exports = new Utils();