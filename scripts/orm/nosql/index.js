'use strict';

var ORM = function () {};

var Adapters = require('./adapters');

ORM.prototype.db = function (opts) {
  var adapter = new Adapters[opts.adapter]();
  return adapter.db(opts);
};

module.exports = new ORM();