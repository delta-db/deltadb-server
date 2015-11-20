'use strict';

var DeltaError = require('../../../../scripts/client/delta-error');

describe('delta-error', function () {

  it('should instantiate', function () {
    new DeltaError('some error');
  });

});
