'use strict';

var partDir = '../../../../scripts/partitioner/sql';

var DeltaError = require(partDir + '/delta-error');

describe('delta-error', function () {

  it('should instantiate', function () {
    new DeltaError('some error');
  });

});
