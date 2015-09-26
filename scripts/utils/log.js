'use strict';

var Log = function () {
  this._silent = true;
};

Log.prototype.setSilent = function (silent) {
  this._silent = silent;
};

Log.prototype._log = function (msg, type) {
  if (!this._silent) {
    console.log(type + ': ' + msg);
  }
};

Log.prototype.info = function (msg) {
  this._log(msg, 'info');
};

Log.prototype.error = function (msg) {
  this._log(msg, 'error');
};

module.exports = new Log();