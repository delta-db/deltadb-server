'use strict';

var Dictionary = require('../../../scripts/utils/dictionary'),
  chai = require('chai'),
  expect = chai.expect;

describe('dictionary', function () {

  it('should set & get', function () {
    var items = new Dictionary();
    items.set('USA', 'WA', 'Seattle');
    items.set('USA', 'NJ', 'Montclair');
    items.set('USA', null, 'DC');
    items.get('USA', 'WA').should.eql('Seattle');
    items.get('USA', 'NJ').should.eql('Montclair');
    items.get('USA', null).should.eql('DC');
  });

  it('should throw error when setting', function () {
    var items = new Dictionary();
    expect(function () {
      items.set();
    }).to.throw('usage: set(key1, [key2, ... keyN], value)');
  });

  it('should exist', function () {
    var items = new Dictionary();
    items.set('USA', 'WA', 'Seattle');
    items.set('USA', null, 'DC');
    items.exists('USA', 'WA').should.eql(true);
    items.exists('USA', 'NJ').should.eql(false);
    items.exists('USA', null).should.eql(true);
  });

  it('should destroy', function () {
    var items = new Dictionary();
    items.set('USA', 'WA', 'Seattle');
    items.destroy('USA', 'WA');
    items.exists('USA', 'WA').should.eql(false);

    items.set('USA', null, 'DC');
    items.destroy('USA', null);
    items.exists('USA', null).should.eql(false);
  });

  it('should each', function () {
    var items = new Dictionary();
    var itemArray = [];

    items.set('USA', 'WA', 'Seattle');
    items.set('USA', 'NJ', 'Montclair');
    items.set('USA', 'NY', 'NYC');
    items.set('USA', null, 'DC');
    items.set('Germany', 'Berlin', 'Berlin');
    items.destroy('USA', 'NJ');

    items.each(function (value, keys) {
      itemArray.push([value, keys]);
    });

    itemArray.should.eql([
      ['Seattle', ['USA', 'WA']],
      ['NYC', ['USA', 'NY']],
      ['DC', ['USA', null]],
      ['Berlin', ['Germany', 'Berlin']]
    ]);
  });

});
