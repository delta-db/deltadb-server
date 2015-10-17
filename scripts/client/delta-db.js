'use strict';

var Adapter = require('./adapter'),
  MemAdapter = require('../orm/nosql/adapters/mem');

var store = new MemAdapter(); // TODO: configurable, e.g. IndexedDB
var client = new Adapter(store);

var DeltaDB = function (name, url) {
  var opts = {
    db: name
  };

  if (typeof url === 'undefined') {
    opts.local = true;
  } else {
    opts.url = url;
  }

  return client.db(opts);
};

var wrapFunction = function (fn) {
  DeltaDB[fn] = function () {
    return client[fn].apply(client, arguments);
  };
};

var wrapFunctions = function () {
  for (var fn in client) {
    if (typeof client[fn] === 'function') {
      wrapFunction(fn);
    }
  }
};

// Expose all methods of client as static DeltaDB functions
wrapFunctions();

module.exports = DeltaDB;