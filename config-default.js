'use strict';

var Config = function () {};

Config.prototype.PORT = 8080;
Config.prototype.DB_NAME_PREFIX = 'delta_';

Config.prototype.POSTGRES_HOST = 'localhost';
Config.prototype.POSTGRES_USER = 'postgres';
Config.prototype.POSTGRES_PWD = 'secret';

module.exports = new Config();
