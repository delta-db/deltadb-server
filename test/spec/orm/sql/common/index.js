'use strict';

var SQL = require('../../../../../scripts/orm/sql/common'),
  chai = require('chai'),
  expect = chai.expect;

describe('common', function () {

  var sql = null;

  beforeEach(function () {
    sql = new SQL();
  });

  it('should template', function () {
    sql._template(0);
  });

  it('should throw error if not escaping number or string', function () {
    expect(function () {
      sql.escape({});
    }).to.throw('[object Object] must be a string or number');
  });

  it('should not escape raw values', function () {
    sql._escapeAndJoin({
      priority: 'high'
    }, {
      'priority': true
    });
  });

  it('should not escape raw values for update', function () {
    sql._escapeAndJoinForUpdate({
      priority: 'high'
    }, {
      'priority': true
    });
  });

  it('should join op', function () {
    var ops = ['joins', 'left_joins', 'full_outer_joins', 'right_joins', 'inner_joins'];
    ops.forEach(function (op) {
      sql._joinOp(op);
    });

    expect(function () {
      sql._joinOp('bad');
    }).to.throw('invalid join op bad');
  });

  it('should op exp', function () {
    var nullOps = ['=', '!='];
    nullOps.forEach(function (op) {
      sql._opExp(op, 'NULL');
    });

    var ops = ['OR', 'AND', '=', '!=', '>', '<', '>=', '<=', '~', '!~'];
    ops.forEach(function (op) {
      sql._opExp(op, 'p2');
    });

    expect(function () {
      sql._opExp('bad', 'NULL');
    }).to.throw('operator BAD not supported');

    expect(function () {
      sql._opExp('bad', 'p2');
    }).to.throw('operator BAD not supported');
  });

  it('should where exp', function () {
    expect(function () {
      sql._whereExp(['age', '<']);
    }).to.throw('where statement ["age","<"] must be an array of size 3 or larger');
  });

  it('should order exp', function () {
    sql._orderExp([
      ['attr1', 'asc'],
      ['attr2', 'desc']
    ]);

    expect(function () {
      sql._orderExp({});
    }).to.throw('order must be an array');

    expect(function () {
      sql._orderExp(['asc']);
    }).to.throw('order ["asc"] must be an array of size 2');

    expect(function () {
      sql._orderExp(['thing', 'badesc']);
    }).to.throw('invalid direction badesc');
  });

  it('should log', function () {
    var log = console.log;
    console.log = function () {}; // mock
    sql._debug = true;
    sql._log('msg');
    console.log = log; // restore
  });

});
