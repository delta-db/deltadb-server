'use strict';

/* global before, after */

var partUtils = require('../utils'),
  constants = require('../../../../../scripts/partitioner/sql/constants'),
  clientTestUtils = require('deltadb/test/utils'),
  testUtils = require('../../../../utils');

describe('quorum', function () {

  var args = partUtils.init(this, beforeEach, afterEach, null, before, after);

  var shouldQuorum = function (secondQuorum) {

    var changes = [{
      col: 'task',
      id: '1',
      name: 'thing',
      val: '"write"',
      up: '2014-01-01T10:00:00.100Z'
    }];

    var attrs = function (partition, quorum, multiple) {
      return testUtils.findAttrs(args.db, partition).then(function (results) {
        var rows = results.rows;
        if (!quorum && partition === constants.LATEST) {
          // LATEST only replaced when quorum
          (rows === null).should.eql(true);
        } else {
          // ALL and RECENT don't replace attrs
          multiple = multiple && (partition === constants.ALL || partition ===
            constants.RECENT);

          var attrs = [{
            name: 'thing',
            value: '"write"',
            updated_at: new Date(changes[0].up),
            quorum: (multiple ? null : quorum)
          }];
          if (multiple) {
            attrs.push({
              name: 'thing',
              value: '"write"',
              updated_at: new Date(changes[0].up),
              quorum: quorum
            });
          }

          testUtils.attrsEql(attrs, rows);
        }
      });
    };

    var allAttrs = function (quorum, multiple) {
      return attrs(constants.ALL, quorum, multiple).then(function () {
        return attrs(constants.RECENT, quorum, multiple);
      }).then(function () {
        return attrs(constants.LATEST, quorum, multiple);
      });
    };

    // Simulate changes first from client, i.e. not setting quorum
    return testUtils.queueAndProcess(args.db, changes).then(function () {
      return allAttrs(null);
    }).then(function () {
      return clientTestUtils.sleep(); // ensure changes w/o quorum processed first
    }).then(function () {
      // Simulate changes from server, i.e. setting quorum
      return testUtils.queueAndProcess(args.db, changes, secondQuorum);
    }).then(function () {
      return allAttrs(secondQuorum, secondQuorum);
    });

  };

  it('should process quorum from server', function () {
    return shouldQuorum(true);
  });

  it('should not reach quorum from client', function () {
    return shouldQuorum(null);
  });

  it('should process partial recordings', function () {

    // Pieces of data may be recorded at different times

    var changes = [{
      col: 'task',
      id: '1',
      name: 'priority',
      val: '"high"',
      up: '2014-01-01T10:00:00.300Z'
    }, {
      col: 'task',
      id: '1',
      name: 'priority',
      val: '"low"',
      up: '2014-01-01T10:01:00.300Z'
    }];

    var latestAttrsAfterClient = function () {
      return testUtils.findAttrs(args.db, constants.LATEST).then(function (results) {
        var rows = results.rows;
        // LATEST only replaced when quorum
        (rows === null).should.eql(true);
      });
    };

    var allOrRecentAttrsAfterClient = function (partition) {
      return testUtils.attrsShouldEql(args.db, partition, [{
        name: 'priority',
        value: '"high"',
        updated_at: changes[0].up
      }, {
        name: 'priority',
        value: '"low"',
        updated_at: changes[1].up
      }]);
    };

    var allAttrsAfterClient = function () {
      return allOrRecentAttrsAfterClient(constants.ALL).then(function () {
        return allOrRecentAttrsAfterClient(constants.RECENT);
      }).then(function () {
        return latestAttrsAfterClient(constants.LATEST);
      });
    };

    var latestAttrsAfterServer = function () {
      return testUtils.attrsShouldEql(args.db, constants.LATEST, [{
        name: 'priority',
        value: '"high"',
        updated_at: changes[0].up,
        quorum: true
      }]);
    };

    var allOrRecentAttrsAfterServer = function (partition) {
      return testUtils.attrsShouldEql(args.db, partition, [{
        name: 'priority',
        value: '"high"',
        updated_at: changes[0].up
      }, {
        name: 'priority',
        value: '"high"',
        updated_at: changes[0].up,
        quorum: true
      }, {
        name: 'priority',
        value: '"low"',
        updated_at: changes[1].up
      }]);
    };

    var allAttrsAfterServer = function () {
      return allOrRecentAttrsAfterServer(constants.ALL).then(function () {
        return allOrRecentAttrsAfterServer(constants.RECENT);
      }).then(function () {
        return latestAttrsAfterServer();
      });
    };

    // Simulate changes first from client, i.e. not setting quorum
    return testUtils.queueAndProcessEach(args.db, changes).then(function () {
      return allAttrsAfterClient();
    }).then(function () {
      return clientTestUtils.sleep(); // ensure changes w/o quorum processed first
    }).then(function () {
      // Simulate changes from server, i.e. setting quorum
      return testUtils.queueAndProcess(args.db, [changes[0]], true);
    }).then(function () {
      return allAttrsAfterServer();
    });

  });

  it('should process recordings that are in the wrong order', function () {

    var changes = [{
      col: 'task',
      id: '1',
      name: 'priority',
      val: '"high"',
      up: '2014-01-01T10:00:00.300Z'
    }, {
      col: 'task',
      id: '1',
      name: 'priority',
      val: '"low"',
      up: '2014-01-01T10:01:00.300Z'
    }];

    var latestAttrsAfterClient = function () {
      return testUtils.findAttrs(args.db, constants.LATEST).then(function (results) {
        var rows = results.rows;
        // LATEST only replaced when quorum
        (rows === null).should.eql(true);
      });
    };

    var allOrRecentAttrsAfterClient = function (partition) {
      return testUtils.attrsShouldEql(args.db, partition, [{
        name: 'priority',
        value: '"high"',
        updated_at: changes[0].up
      }, {
        name: 'priority',
        value: '"low"',
        updated_at: changes[1].up
      }]);
    };

    var allAttrsAfterClient = function () {
      return allOrRecentAttrsAfterClient(constants.ALL).then(function () {
        return allOrRecentAttrsAfterClient(constants.RECENT);
      }).then(function () {
        return latestAttrsAfterClient();
      });
    };

    var latestAttrsAfterServer = function () {
      return testUtils.attrsShouldEql(args.db, constants.LATEST, [{
        name: 'priority',
        value: '"low"',
        updated_at: changes[1].up,
        quorum: true
      }]);
    };

    var allOrRecentAttrsAfterServer = function (partition) {
      return testUtils.attrsShouldEql(args.db, partition, [{
        name: 'priority',
        value: '"high"',
        updated_at: changes[0].up
      }, {
        name: 'priority',
        value: '"low"',
        updated_at: changes[1].up
      }, {
        name: 'priority',
        value: '"low"',
        updated_at: changes[1].up,
        quorum: true
      }]);
    };

    var allAttrsAfterServer = function () {
      return allOrRecentAttrsAfterServer(constants.ALL).then(function () {
        return allOrRecentAttrsAfterServer(constants.RECENT);
      }).then(function () {
        return latestAttrsAfterServer();
      });
    };

    // Simulate changes first from client, i.e. not setting quorum
    return testUtils.queueAndProcess(args.db, changes).then(function () {
      return allAttrsAfterClient();
    }).then(function () {
      return clientTestUtils.sleep(); // ensure changes w/o quorum processed first
    }).then(function () {
      // Simulate changes from server, i.e. setting quorum
      return testUtils.queueAndProcess(args.db, [changes[1]], true);
    }).then(function () {
      return allAttrsAfterServer();
    });

  });

  it('should ignore duplicate changes', function () {

    // Let's say we have a server loop like a->b->c->a, a needs to ignore duplicates as otherwise
    // when c syncs with a, it will create new recordings that will create an infinite loop of
    // recordings

    var changes = [{
        col: 'task',
        id: '1',
        name: 'thing',
        val: '"write"',
        up: '2014-01-01T10:00:00.100Z'
      }, {
        col: 'task',
        id: '1',
        name: 'thing',
        val: '"play"',
        up: '2014-01-01T10:00:00.100Z',
        seq: 1
      }, // updated at same time
      {
        col: 'task',
        id: '1',
        name: 'thing',
        up: '2014-01-01T10:01:00.100Z'
      }, // attr del
      {
        col: 'task',
        id: '1',
        up: '2014-01-01T10:02:00.100Z'
      }
    ]; // doc del

    var allOrRecentAttrs = function (partition) {
      return testUtils.attrsShouldEql(args.db, partition, [{
        name: 'thing',
        value: '"write"',
        updated_at: changes[0].up,
        quorum: true
      }, {
        name: 'thing',
        value: '"play"',
        updated_at: changes[1].up,
        seq: 1,
        quorum: true
      }, {
        name: 'thing',
        value: null,
        updated_at: changes[2].up,
        quorum: true
      }, {
        name: null,
        value: null,
        updated_at: changes[3].up,
        quorum: true
      }]);
    };

    var latestAttrs = function () {
      return testUtils.attrsShouldEql(args.db, constants.LATEST, [{
        name: 'thing',
        value: null,
        updated_at: changes[2].up
      }, {
        name: null,
        value: null,
        updated_at: changes[3].up
      }], true);
    };

    var allAttrs = function () {
      return allOrRecentAttrs(constants.ALL).then(function () {
        return allOrRecentAttrs(constants.RECENT);
      }).then(function () {
        return latestAttrs();
      });
    };

    // Simulate changes from syncing with first server
    return testUtils.queueAndProcess(args.db, changes, true).then(function () {
      return allAttrs();
    }).then(function () {
      return clientTestUtils.sleep(); // ensure changes w/o quorum processed first
    }).then(function () {
      // Simulate changes from syncing with second server where duplicate changes would be received
      return testUtils.queueAndProcess(args.db, changes, true);
    }).then(function () {
      return allAttrs();
    });

  });

});
