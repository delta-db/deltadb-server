'use strict';

var Item = require('../../../scripts/client/item');

describe('item', function () {

  var FakeItem = function () {
    this.get = function () {
      return {};
    };
  };

  it('should record when remote change has seq', function () {
    var item = new Item(new FakeItem()),
      updated = new Date();

    item._changes = [{
      name: 'priority',
      val: 'high',
      up: updated,
      seq: 1
    }];

    item._record('priority', 'high', updated);
  });

});