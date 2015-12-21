'use strict';

var Server = require('../../../scripts/server/server'),
  commonUtils = require('deltadb-common-utils');

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
    server._partitioners.unregister = commonUtils.promiseErrorFactory(new Error(
      'some error'));

    // _queueChanges should catch the error so it should not be thrown
    return server._unregister();
  });

  it('should catch error when queuing changes', function () {
    // Fake
    server._partitioners._queueChanges = commonUtils.promiseErrorFactory(new Error(
      'some error'));

    // _queueChanges should catch the error so it should not be thrown
    return server._queueChanges();
  });

  it('should set options for ssl with ca', function () {
    var file = 'index.js', // Fake cert files with any file
      options = {};
    server._setOptions(true, options, file, file, file);
  });

  it('should set options for ssl without ca', function () {
    var file = 'index.js', // Fake cert files with any file
      options = {};
    server._setOptions(true, options, file, file);
  });

  it('should create server for ssl', function () {
    var https = {
      createServer: function () {} // fake
    };
    server._createServer(true, {}, https);
  });

  it('should get scheme for ssl', function () {
    server._scheme(true).should.eql('https');
  });

});
