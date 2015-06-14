'use strict';

var Item = require('../../../../../scripts/orm/nosql/common/item');

describe('item', function () {

  it('should edge test', function () {
    var item = new Item();
    item._set('priority', 'high', true);
    item.dirty();
  });

});