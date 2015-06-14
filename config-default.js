'use strict';

var Config = function () {};

Config.prototype.POSTGRES_HOST = 'localhost';
Config.prototype.POSTGRES_USER = 'postgres';

module.exports = new Config();