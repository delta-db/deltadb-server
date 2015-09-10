'use strict';

var utils = require('../../../scripts/utils'),
  commonTestUtils = require('../../common-utils'),
  // bcrypt = require('bcrypt'); // TODO: use for server as faster?
  bcrypt = require('bcryptjs'),
  EventEmitter = require('events').EventEmitter,
  Promise = require('bluebird');

describe('utils', function () {

  var genSalt = bcrypt.genSalt,
    hash = bcrypt.hash;

  afterEach(function () {
    // Restore fakes
    utils._bcrypt.genSalt = genSalt;
    utils._bcrypt.hash = hash;
  });

  it('should clone', function () {
    var obj = {
      foo: {
        bar: 1
      }
    };
    var clonedObj = utils.clone(obj);
    clonedObj.should.eql(obj); // is a deep copy
    (clonedObj === obj).should.eql(false); // is not a shallow copy
  });

  it('should keys', function () {
    utils.keys({
      a: 1,
      b: 2
    }).should.eql(['a', 'b']);
  });

  it('should check for empty obj', function () {
    utils.empty({
      attr: 'stuff'
    }).should.eql(false);
  });

  it('should resolve factory', function () {
    var promise = utils.resolveFactory();
    return promise().then(function () {
      // empty case
    });
  });

  it('should promise error', function () {
    var err = new Error('my error');
    var promiseFactory = function () {
      return utils.promiseError(err);
    };
    return commonTestUtils.shouldThrow(promiseFactory, err);
  });

  it('should merge', function () {
    utils.merge({
      a: 1,
      b: 2
    }, {
      b: 20,
      c: 3
    }).should.eql({
      a: 1,
      b: 20,
      c: 3
    });
    utils.merge(null, null).should.eql({});
  });

  it('should hash', function () {
    return utils.genSalt().then(function (salt) {
      return utils.hash('secret', salt);
    }).then(function (hash) {
      (hash === null).should.eql(false);
    });
  });

  it('should reject salt and hash when salt err', function () {
    utils._bcrypt.genSalt = function (rounds, cb) {
      cb(new Error('error'));
    };

    return commonTestUtils.shouldThrow(function () {
      return utils.genSaltAndHashPassword('secret');
    }, new Error('error'));
  });

  it('should reject salt and hash when hash err', function () {
    utils._bcrypt.hash = function (password, salt, cb) {
      cb(new Error('error'));
    };

    return commonTestUtils.shouldThrow(function () {
      return utils.genSaltAndHashPassword('secret');
    }, new Error('error'));
  });

  it('should hash password', function () {
    return utils.genSalt().then(function (salt) {
      return utils.hashPassword('secret', salt).then(function (data) {
        data.salt.should.eql(salt);
        (data.hash === null).should.eql(false);
      });
    });
  });

  it('should identify undefined', function () {
    var foo = function (myVar) {
      utils.notDefined(myVar).should.eql(true);
    };
    foo();
  });

  it('should identify defined', function () {
    var myVar = null;
    utils.isDefined(myVar).should.eql(true);
  });

  it('should do and then emit once', function () {
    var emitter = new EventEmitter(),
      args = {
        foo: 'bar'
      };

    var promiseFactory = function () {
      return Promise.resolve().then(function () {
        emitter.emit('my-event', args);
      });
    };

    return utils.doAndOnce(promiseFactory, emitter, 'my-event').then(function (_args) {
      _args[0].should.eql(args);
    });
  });

  it('should once', function () {
    var emitter = new EventEmitter(),
      args = {
        foo: 'bar2'
      };

    setTimeout(function () {
      emitter.emit('my-event', args);
    }, 1);

    return utils.once(emitter, 'my-event').then(function (_args) {
      _args[0].should.eql(args);
    });
  });

  it('should sort', function () {
    var items = [{
      a: 2
    }, {
      a: null,
      b: -1
    }, {
      a: 5,
      b: null,
      c: '3'
    }, {
      a: 5,
      c: '2'
    }, {
      b: 1,
      c: '2'
    }, {
      b: 1,
      c: '3'
    }];

    var sortedItems = [{
      a: 2
    }, {
      a: 5,
      c: '2'
    }, {
      a: 5,
      b: null,
      c: '3'
    }, {
      b: 1,
      c: '2'
    }, {
      b: 1,
      c: '3'
    }, {
      a: null,
      b: -1
    }];

    utils.sort(items, ['a', 'c', 'b']).should.eql(sortedItems);
  });

  it('should convert to args array', function () {
    function list() {
      return utils.toArgsArray(arguments);
    }

    list(1, 2, 3).should.eql([1, 2, 3]);
  });

});