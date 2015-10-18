'use strict';

var Adapter = require('./adapter'),
  client = new Adapter();

var DeltaDB = function (name, url, store) {
  var opts = {
    db: name
  };

  if (url) {
    opts.url = url;
  } else {
    opts.local = true;
  }

  if (typeof store !== 'undefined') {
    opts.store = store;
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