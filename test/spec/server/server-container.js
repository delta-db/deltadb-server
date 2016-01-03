'use strict';

var ServerContainer = require('../../../scripts/server'),
  Promise = require('bluebird');

describe('server-container', function () {

  var serverContainer = null,
    defRetryMS = ServerContainer._RETRY_MS,
    destroy = null;

  beforeEach(function () {
    serverContainer = new ServerContainer();
    destroy = true;
  });

  afterEach(function () {
    ServerContainer._RETRY_MS = defRetryMS;
    if (destroy) {
      return serverContainer._system.destroy();
    }
  });

  it('should create system db when missing', function () {
    return serverContainer._ensureSystemDBCreated();
  });

  it('should retry creating of system db', function () {
    var retry = 0,
      expectedRetries = 2;

    destroy = false; // don't destroy as we have just faked the creation

    ServerContainer._RETRY_MS = 1; // set to 1 for testing

    serverContainer._partitioner = { // fake
      dbExists: function () {
        return new Promise(function (resolve, reject) {
          if (++retry === expectedRetries) {
            resolve(true); // fake that system DB exists
          } else {
            reject(new Error('my error'));
          }
        });
      }
    };

    // The promise will timeout if something goes wrong
    return serverContainer._ensureSystemDBCreated().then(function () {
      retry.should.eql(expectedRetries);
    });
  });

});
