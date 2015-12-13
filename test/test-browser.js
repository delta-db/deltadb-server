'use strict';

// Set config so that our test server doesn't interfere with any production server. We need to set
// the config first so that all of the following code uses this config.
var config = require('../config'),
  testConfig = require('./config'),
  clientConfig = require('deltadb/scripts/config');
for (var i in testConfig) {
  config[i] = testConfig[i];
  clientConfig[i] = testConfig[i];
}

var chai = require('chai');
chai.use(require('chai-as-promised'));
chai.should(); // var should = chai.should();

var testUtils = require('./utils');

describe('browser', function () {

  this.timeout(testUtils.TIMEOUT);

  require('./browser');

});
