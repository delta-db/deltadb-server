'use strict';

/* global before */

var log = require('../../scripts/client/log');

describe('browser', function () {

  before(function () {
    // For debugging
    log.console(true);
  });

  require('./adapters');

  require('../spec/orm/nosql');

  require('../spec/utils/utils');

  require('../spec/utils/log');

  require('../spec/client');

  require('../e2e/e2e');

});
