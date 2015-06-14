'use strict';

var ORM = function () {};

var Adapters = require('./adapters');

ORM.prototype.connect = function (opts) {
  var adapter = new Adapters[opts.adapter]();
  return adapter.connect(opts);
};

module.exports = new ORM();