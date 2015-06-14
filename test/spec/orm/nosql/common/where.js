'use strict';

var where = require('../../../../../scripts/orm/nosql/common/where'),
  chai = require('chai'),
  expect = chai.expect;

describe('where', function () {

  it('should filter', function () {
    var doc = {
      name: 'Jill',
      age: 35
    };
    var query = [
      [
        [
          ['age', '<', 33], 'and', ['name', '=', 'Jill']
        ], 'or', [
          ['age', '>', 33], 'and', ['name', '=', 'Jack']
        ]
      ], 'or', [
        ['age', '!=', 20], 'and', [
          ['age', '>=', 20], 'and', ['age', '<=', 21]
        ]
      ]
    ];
    var filter = where.filter(query);
    filter(doc);
  });

  it('should throw error if where not array', function () {
    var filter = where.filter('bad');
    expect(function () {
      filter();
    }).to.throw('where statement "bad" must be an array of size 3');
  });

  it('should throw error if where contains unknown operator', function () {
    var filter = where.filter(['age', 'BAD', 33]);
    expect(function () {
      filter({
        name: 'Jill',
        age: 35
      });
    }).to.throw('operator BAD not supported');
  });

});