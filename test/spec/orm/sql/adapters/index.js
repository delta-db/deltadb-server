'use strict';

// The majority of tests should be generic and apply to all ORMs. Only adapter specific tests should
// be tested below.

describe('adapters', function () {
  require('./postgres');
});