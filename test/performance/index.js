'use strict';

var chai = require('chai');
chai.use(require('chai-as-promised'));
chai.should(); // var should = chai.should();

describe('performance', function () {
  require('./delta');
  require('./raw-orm');
  require('./raw-postgres');
  require('./raw-mysql');
});
