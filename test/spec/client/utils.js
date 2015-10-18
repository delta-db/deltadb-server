'use strict';

var clientUtils = require('../../../scripts/client/utils');

describe('utils', function () {

  it('should gen user', function () {
    return clientUtils.genUser('user-uuid', 'username', 'secret').then(function (user) {
      user.uuid.should.eql('user-uuid');
      user.username.should.eql('username');
      user.status.should.eql('enabled');
      (user.salt === null).should.eql(false);
      (user.password === null).should.eql(false);
    });
  });

  it('should convert to doc uuid', function () {
    var docUUID = clientUtils.toDocUUID('user-uuid');
    docUUID.should.eql(clientUtils.UUID_PRE + 'user-uuid');
  });

  it('should sleep', function () {
    var before = new Date();
    return clientUtils.timeout(1000).then(function () {
      var after = new Date();
      var elapsed = after.getTime() - before.getTime();
      (elapsed >= 1000 && elapsed < 1200).should.eql(true); // allow for 200 ms window
    });
  });

});
