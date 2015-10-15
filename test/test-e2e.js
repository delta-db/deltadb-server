'use strict';

var chai = require('chai');
chai.use(require('chai-as-promised'));
chai.should(); // var should = chai.should();

describe('deltadb', function () {

  // TODO: have to spawn server for tests. Spawn on diff port. Prefix w/ namespace so doesn't
  // conflict w/ production?
  require('./e2e');

});