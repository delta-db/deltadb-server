'use strict';

var Server = require('../../../scripts/server/server'),
  testUtils = require('../../utils');

describe('server', function () {

  var server = null;

  beforeEach(function () {
    server = new Server();
  });

  it('should extract since', function () {
    var msg = {
      since: '2011-10-05T14:48:00.000Z'
    };
    server._since(msg).should.eql(new Date('2011-10-05T14:48:00.000Z'));
  });

  it('should catch error when unregistering', function () {
    // Fake
    server._partitioners.unregister = testUtils.promiseErrorFactory(new Error('some error'));

    // _queueChanges should catch the error so it should not be thrown
    return server._unregister();
  });

  it('should catch error when queuing changes', function () {
    // Fake
    server._partitioners._queueChanges = testUtils.promiseErrorFactory(new Error(
      'some error'));

    // _queueChanges should catch the error so it should not be thrown
    return server._queueChanges();
  });

});
