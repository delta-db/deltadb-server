'use strict';

var Config = function () {};

Config.prototype.DB_NAME_PREFIX = 'delta_test_';

Config.prototype.SCHEME = 'http';

// Set config so that our test server doesn't interfere with any production server
Config.prototype.PORT = 8081;

Config.prototype.URL = Config.prototype.SCHEME + '://localhost:' + Config.prototype.PORT;

Config.prototype.POSTGRES_HOST = 'localhost';
Config.prototype.POSTGRES_USER = 'postgres';
Config.prototype.POSTGRES_PWD = 'secret';

module.exports = new Config();
