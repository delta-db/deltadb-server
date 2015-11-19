'use strict';

var ServerContainer = require('../../../scripts/server');

describe('server-container', function () {

  var serverContainer = null;

  beforeEach(function () {
    serverContainer = new ServerContainer();
  });

  afterEach(function () {
    return serverContainer._system.destroy();
  });

  it('should create system db is missing', function () {
    return serverContainer._ensureSystemDBCreated();
  });

});
