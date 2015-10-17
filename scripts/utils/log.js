'use strict';

var Log = function () {
  this._stream = null;
  this._console = false;
};

Log.prototype.console = function (on) {
  this._console = on;
};

Log.prototype._msg = function (msg, type) {
  return type + ': ' + (new Date()) + ': ' + msg + "\n";
};

Log.prototype._log = function (msg, type) {
  if (this._stream) {
    this._stream.write(this._msg(msg, type) + "\n");
  } else if (this._console) {
    console.log(this._msg(msg, type));
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

Log.prototype.stream = function (stream) {
  this._stream = stream;
};

module.exports = Log;
