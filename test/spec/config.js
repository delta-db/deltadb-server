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

  it('should load values from config.json', function () {
    var fs = {
      readFileSync: function () { // fake
        return '{}';
      }
    };
    config._loadVals(fs);
  });

  it('should load values from config-default.json', function () {
    var fs = {
      readFileSync: function (name) { // fake
        if (name === 'config.json') {
          throw new Error('config.json missing');
        } else {
          return '{}';
        }
      }
    };
    config._loadVals(fs);
  });

});
