/*

// SAVE FOR FUTURE

'use strict';

/* global before, after *

var partDir = '../../../../scripts/partitioner/sql';

var partUtils = require('./utils'),
  Cols = require(partDir + '/col/cols'),
  Roles = require(partDir + '/roles'),
  Promise = require('bluebird'),
  SQLError = require('deltadb-orm-sql/scripts/common/sql-error'),
  MissingError = require('deltadb-orm-sql/scripts/common/missing-error'),
  Sessions = require(partDir + '/sessions'),
  TokenError = require(partDir + '/token-error'),
  SessionExpiredError = require(partDir + '/session-expired-error'),
  commonUtils = require('deltadb-common-utils'),
  commonTestUtils = require('deltadb-common-utils/scripts/test-utils');

describe('sessions', function () {

  var args = partUtils.init(this, beforeEach, afterEach, false, before, after);

  var userUtils = null; // for convenience
  beforeEach(function () {
    userUtils = args.userUtils;
  });

  it('should generate different tokens', function () {
    var token1 = args.db._sessions._genToken();
    var token2 = args.db._sessions._genToken();
    token2.should.not.eql(token1);
  });

  it('should create record', function () {
    return args.db._sessions._createRecord(1, 'token').then(function (token) {
      (token !== null).should.eql(true);
    });
  });

  it('should not create duplicate token', function () {
    return commonTestUtils.shouldThrow(function () {
      return args.db._sessions._createRecord(1, 'token').then(function () {
        return args.db._sessions._createRecord(2, 'token');
      });
    }, new SQLError());
  });

  it('should attempt to create', function () {
    return args.db._sessions._attemptToCreate(1).then(function (token) {
      (token !== null).should.eql(true);
    });
  });

  it('should throw error if all creation attempts fail', function () {
    return commonTestUtils.shouldThrow(function () {
      return args.db._sessions._attemptToCreate(1, Sessions.MAX_TOKEN_ATTEMPTS);
    }, new TokenError('failed to create token after ' + Sessions.MAX_TOKEN_ATTEMPTS +
      ' attempts'));
  });

  it('should throw error if all create record throws non-sql error', function () {
    args.db._sessions._createRecord = commonUtils.promiseErrorFactory(new Error('err'));
    return commonTestUtils.shouldThrow(function () {
      return args.db._sessions._attemptToCreate();
    }, new Error('err'));
  });

  it('should create even if first attempts fail', function () {
    var attempt = 0;
    args.db._sessions._createRecord = function () {
      return new Promise(function (resolve) {
        if (++attempt < 3) {
          throw new SQLError('err'); // fake duplicate token
        } else {
          resolve('token');
        }
      });
    };

    return args.db._sessions._create(1).then(function (token) {
      token.should.eql('token');
      attempt.should.eql(3);
    });
  });

  it('should authenticate', function () {
    args.db._users.authenticated = commonUtils.resolveFactory(1);
    args.db._sessions._create = commonUtils.resolveFactory('token');
    return args.db._sessions.authenticate().then(function (token) {
      token.should.eql('token');
    });
  });

  it('should find', function () {
    return args.db._sessions._createRecord(1, 'token').then(function () {
      return args.db._sessions._find('token');
    }).then(function (results) {
      results.rows[0].user_id.should.eql(1);
    });
  });

  it('should not find', function () {
    return commonTestUtils.shouldThrow(function () {
      return args.db._sessions._find('token');
    }, new MissingError());
  });

  it('should succeed when checking authentication', function () {
    var expiresAt = new Date((new Date()).getTime() - 1000000);
    args.db._sessions._find = commonUtils.resolveFactory({
      rows: [{
        user_id: 1,
        expires_at: expiresAt
      }]
    });
    return args.db._sessions.authenticated('token').then(function (userId) {
      userId.should.eql(1);
    });
  });

  it('should fail authentication when session expired', function () {
    var expiresAt = new Date((new Date()).getTime() + 1000000);
    args.db._sessions._find = commonUtils.resolveFactory({
      rows: [{
        user_id: 1,
        expires_at: expiresAt
      }]
    });
    return commonTestUtils.shouldThrow(function () {
      return args.db._sessions.authenticated('token');
    }, new SessionExpiredError());
  });

  //   it('should destroy expired when checking authentication', function () {
  // // TODO
  //   });

  //   it('should refresh', function () {
  // // TODO
  //   });

  //   it('should destroy', function () {
  // // TODO
  //   });

  //   it('should destroy expired', function () {
  // // TODO
  //   });

});

*/
