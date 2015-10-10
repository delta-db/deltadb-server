'use strict';

// TMP - BEGIN
var log = require('../../scripts/utils/log');
log.setSilent(false);
// TMP - END

describe('e2e', function () {

  require('./basic.js');

  require('./multiple.js');

});
