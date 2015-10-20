'use strict';

/* global before */

var log = require('../../scripts/client/log');

describe('browser', function () {

  before(function () {
    // For debugging
    log.console(true);
  });

  require('./adapters');

  require('../spec/orm/nosql/common');

  require('../spec/utils/utils');

  require('../spec/client');

  require('../e2e/e2e');

});
