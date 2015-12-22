'use strict';

// Set config so that our test server doesn't interfere with any production server. We need to set
// the config first so that all of the following code uses this config.
var config = require('../../config'),
  testConfig = require('../config'),
  clientConfig = require('deltadb/scripts/config');
for (var i in testConfig) {
  config.vals[i] = testConfig[i];
  clientConfig.vals[i] = testConfig[i];
}

var chai = require('chai');
chai.use(require('chai-as-promised'));
chai.should(); // var should = chai.should();

var browserTestUtils = require('./utils'),
  log = require('deltadb/scripts/log');

describe('browser', function () {

  this.timeout(browserTestUtils.TIMEOUT);

  before(function () {
    // For debugging
    log.console(true);
  });

  require('../e2e/e2e');

});
