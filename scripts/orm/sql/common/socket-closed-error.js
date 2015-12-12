'use strict';

var SQLError = require('deltadb-orm-sql/scripts/common/sql-error'),
  inherits = require('inherits');

var SocketClosedError = function (message) {
  this.name = 'SocketClosedError';
  this.message = message;
};

inherits(SocketClosedError, SQLError);

module.exports = SocketClosedError;
