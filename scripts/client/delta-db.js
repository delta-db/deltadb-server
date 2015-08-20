'use strict';

var Adapter = require('./adapter'),
  MemAdapter = require('../orm/nosql/adapters/mem');

var store = new MemAdapter(); // TODO: change to web socket
var client = new Adapter(store);

var DeltaDB = function (name /* , host, username, password */ ) {
  return client.db({
    db: name
  });
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