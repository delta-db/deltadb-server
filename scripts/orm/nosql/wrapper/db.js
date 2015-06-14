'use strict';

// TODO: Could probably generalize the following for different types of wrappers

var inherits = require('inherits'),
  utils = require('../../../utils'),
  AbstractDB = require('../common/db');

var DB = function (db) {
  utils.wrapMissing(this, db);
  this._db = db;
};

inherits(DB, AbstractDB);

utils.wrapFunctions(DB, '_db');

module.exports = DB;