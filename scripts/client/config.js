'use strict';

var Config = function () {};

Config.prototype.PORT = 8081;

// TODO: can we change this to https?
Config.prototype.URL = 'http://localhost:' + Config.prototype.PORT;

module.exports = new Config();
