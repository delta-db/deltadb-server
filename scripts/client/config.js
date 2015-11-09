'use strict';

var Config = function () {};

Config.prototype.PORT = 8080;

Config.prototype.DB_NAME_PREFIX = 'delta_';

// TODO: can we change this to https?
Config.prototype.URL = 'http://localhost:' + Config.prototype.PORT;

module.exports = new Config();
