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

  it('should set container when exists', function () {
    // This can occur when there is a race condition and can be hard to test w/o faking

    // Fake
    var socket = {
      conn: {
        id: 1
      }
    };

    // Fake
    var container = {
      conns: {
        1: {}
      }
    };

    // Fake
    partitioners._partitioners['dbname'] = {
      conns: {}
    };

    partitioners._setContainer('dbname', socket, container);

    partitioners._partitioners['dbname'].conns['1'].should.eql(container.conns['1']);
  });

});
