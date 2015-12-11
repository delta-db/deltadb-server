'use strict';

var DeltaError = require('deltadb/scripts/delta-error');

describe('delta-error', function () {

  it('should instantiate', function () {
    new DeltaError('some error');
  });

});
