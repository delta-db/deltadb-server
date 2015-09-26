'use strict';

var Log = function () {
  
};

Log.prototype._log = function (msg, type) {
  console.log(type + ': ' + msg);
};

Log.prototype.info = function (msg) {
  this._log(msg, 'info');
};

Log.prototype.error = function (msg) {
  this._log(msg, 'error');
};

module.exports = new Log();