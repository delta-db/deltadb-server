'use strict';

var fs = require('fs');

var Config = function () {
  this._loadVals(fs);
};

// We define _fs so that we can test this fn
Config.prototype._loadVals = function (_fs) {
  var json = null;
  try {
    json = _fs.readFileSync('config.json');
  } catch (err) {
    json = _fs.readFileSync('config-default.json');
  }
  this.vals = JSON.parse(json);
};

Config.prototype.url = function () {
  var url = this.vals.url;
  return url.scheme + '://' + url.host + (url.port ? ':' + url.port : '');
};

module.exports = new Config();
