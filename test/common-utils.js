'use strict';

var Utils = function () {};

// If err.message is falsy then only ensures that both errors are of the same type
Utils.prototype.shouldThrow = function (fun, err) {
  var self = this;
  return fun().then(function () {
    self.never();
  }).catch(function (_err) {
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