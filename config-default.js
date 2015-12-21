'use strict';

var Config = function () {};

Config.prototype.DB_NAME_PREFIX = 'delta_';

Config.prototype.SCHEME = 'http';
Config.prototype.PORT = 8080;

// For SSL, uncomment below:
// Config.prototype.SCHEME = 'https';
// Config.prototype.SSL_KEY = '/path/to/domain.key';
// Config.prototype.SSL_CERT = '/path/to/domain.crt';

Config.prototype.URL = Config.prototype.SCHEME + '://localhost:' + Config.prototype.PORT;

Config.prototype.POSTGRES_HOST = 'localhost';
Config.prototype.POSTGRES_USER = 'postgres';
Config.prototype.POSTGRES_PWD = 'secret';

module.exports = new Config();
