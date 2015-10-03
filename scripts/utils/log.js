'use strict';

var Log = function () {
  this._silent = true;
};

Log.prototype.setSilent = function (silent) {
  this._silent = silent;
};

Log.prototype._log = function (msg, type) {
  if (!this._silent) {
    console.log(type + ': ' + (new Date()) + ': ' + msg + "\n");
  }
};

Log.prototype.info = function (msg) {
  this._log(msg, 'Info');
};

Log.prototype.warning = function (msg) {
  this._log(msg, 'Warning');
};

Log.prototype.error = function (msg) {
  this._log(msg, 'Error');
};

module.exports = new Log();