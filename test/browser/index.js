'use strict';

/* global before */

var log = require('deltadb/scripts/log');

describe('browser', function () {

  before(function () {
    // For debugging
    log.console(true);
  });

  require('../e2e/e2e');

});
