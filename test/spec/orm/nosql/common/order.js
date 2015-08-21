'use strict';

var order = require('../../../../../scripts/orm/nosql/common/order'),
  chai = require('chai'),
  expect = chai.expect;

describe('order', function () {

  var Doc = function (doc) {
    this.get = function () {
      return doc;
    };
  };

  var docs = null;

  beforeEach(function () {
    docs = [new Doc({
        thing: 'play',
        priority: 'high'
      }),
      new Doc({
        thing: 'sing',
        priority: 'medium'
      }),
      new Doc({
        thing: 'sing',
        priority: 'low'
      })
    ];
  });

  it('should sort by single attr', function () {
    docs.sort(order.sort(['thing', 'asc']));
  });

  it('should sort by single attr desc', function () {
    docs.sort(order.sort(['thing', 'desc']));
  });

  it('should sort by multiple attrs', function () {
    docs.sort(order.sort([
      ['thing', 'asc'],
      ['priority', 'asc']
    ]));
  });

  it('should throw error if order not array', function () {
    expect(function () {
      docs.sort(order.sort());
    }).to.throw('order statement undefined must be an array');
  });

  it('should throw error if order is not array of size 2', function () {
    expect(function () {
      docs.sort(order.sort(['thing']));
    }).to.throw('order statement ["thing"] must be an array of size 2');
  });

});