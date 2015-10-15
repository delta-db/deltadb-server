'use strict';

var Doc = require('../../../../../scripts/orm/nosql/common/doc');

describe('doc', function () {

  it('should edge test', function () {
    var doc = new Doc();
    doc._set('priority', 'high', true);
    doc.dirty();
  });

});