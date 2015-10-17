'use strict';

var Config = function () {};

// Set config so that our test server doesn't interfere with any production server
Config.prototype.PORT = 8081;
Config.prototype.DB_NAME_PREFIX = 'delta_test_';

// TODO: can we change this to https?
Config.prototype.URL = 'http://localhost:' + Config.prototype.PORT;

Config.prototype.POSTGRES_HOST = 'localhost';
Config.prototype.POSTGRES_USER = 'postgres';
Config.prototype.POSTGRES_PWD = 'secret';

module.exports = new Config();
