'use strict';

var partDir = '../../../../../scripts/partitioner/sql',
  AttrParams = require(partDir + '/attr/attr-params');

describe('attr-params', function () {

  it('should parse', function () {
    var params = new AttrParams();
    params.parse();
  });

});
