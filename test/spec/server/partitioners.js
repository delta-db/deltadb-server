'use strict';

var Partitioners = require('../../../scripts/server/partitioners');

describe('partitioners', function () {

  var partitioners = null;

  beforeEach(function () {
    partitioners = new Partitioners();
  });

  it('should replace uid', function () {
    // Fake
    partitioners._userUUID = function () {
      return 'user-uuid-2';
    };

    // Fake
    var changes = [{ uid: 'user-uuid-1' }];

    partitioners._addUserUUID(null, null, changes);

    // Make sure uid gets replaced
    changes[0].uid.should.eql('user-uuid-2');
  });

});
