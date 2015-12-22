'use strict';

var config = require('../../config'),
  utils = require('deltadb-common-utils');

describe('config', function () {

  var vals = null;

  beforeEach(function () {
    // Back up
    vals = config.vals;
    config.vals = utils.clone(config.vals);
  });

  afterEach(function () {
    // Restore from backup
    config.vals = vals;
  });

  it('should build url when port is missing', function () {
    config.vals.url.port = null;
    (config.url() === null).should.eql(false);
  });

});
