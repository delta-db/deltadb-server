'use strict';

var Doc = require('../../../../../scripts/orm/nosql/common/doc');

describe('item', function () {

  it('should edge test', function () {
    var item = new Doc();
    item._set('priority', 'high', true);
    item.dirty();
  });

});