'use strict';

var Partitioner = require('../partitioner/sql');

var Partitioners = function () {
  this._partitioners = {};
};

Partitioners.prototype.register = function (dbName, connId) {
  // TODO: should connect be done here? If so then how to report error if no connection?
  if (this._partitioners[dbName]) { // exists?
    this._partitioners[dbName]['ids'][connId] = connId; // register the connId
  } else {
    // First conn for this partitioner
    this._partitioners[dbName] = {
      part: new Partitioner(dbName),
      ids: {}
    };
  }
  return this._partitioners[dbName]['part'];
};

Partitioners.prototype.unregister = function (dbName, connId) {
  // Remove the connId
  delete this._partitioners[dbName]['ids'][connId];

  // Delete partitioner if no more connections for this partition
  if (this._partitioners[dbName]['ids'].length === 0) {
    delete this._partitioners[dbName];
  }
};

module.exports = Partitioners;