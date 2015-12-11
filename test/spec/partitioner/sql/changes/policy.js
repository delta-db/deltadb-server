'use strict';

// TODO: throw exception when errors in changes formatting

// TODO: split up and/or abstract boilerplate code

var partUtils = require('../utils');

describe('policy', function () {

  var args = partUtils.init(this, beforeEach, afterEach, null, before, after);
  var testUtils = args.utils;

  var userUtils = null; // for convenience
  beforeEach(function () {
    userUtils = args.userUtils;
  });

  var queueAndProcess = function (changes) {
    // Force quorum=true. We don't need to consider quorum when getting changes as only changes
    // recorded by quorum are added to LATEST and server downloads all changes regardless of quorum
    // status.
    return testUtils.queueAndProcess(args.db, changes, true);
  };

  it('should omit policy, users and roles', function () {
    var policy = {
      col: {
        read: 'poster'
      }
    };

    return userUtils.setPolicy(policy).then(function () {
      return userUtils.createUser(userUtils.userUUID, 'user', 'secret');
    }).then(function () {
      return userUtils.addUserRole(userUtils.userUUID, 'poster');
    }).then(function () {
      // TODO: test getting initial changes, recent, all, etc...
      return testUtils.changes(args.db, null, null, null, null, null, userUtils.userUUID);
    }).then(function (chngs) {
      chngs.should.eql([]);
    });
  });

  it('should include policy, users and roles', function () {
    var policy = {
      col: {
        read: 'poster'
      }
    };

    return userUtils.setPolicy(policy).then(function () {
      return userUtils.createUser(userUtils.userUUID, 'user', 'secret');
    }).then(function () {
      return userUtils.addUserRole(userUtils.userUUID, 'poster');
    }).then(function () {
      // TODO: test getting initial changes, recent, all, etc...
      return testUtils.changes(args.db, null, null, null, null, true, userUtils.userUUID);
    }).then(function (chngs) {
      testUtils.contains([{
          name: '$ruser'
        }, {
          name: '$role'
        }, {
          name: '$user'
        }, {
          name: '$policy'
        }],
        testUtils.sortChanges(chngs));
    });
  });

  it('should include doc when all can read and authenticated but not owner', function () {
    var changes = [{
      col: 'task',
      id: '1',
      name: 'priority',
      val: '"high"',
      up: '2014-01-01T10:00:00.000Z',
      uid: userUtils.userUUID
    }];

    return queueAndProcess(changes).then(function () {
      return testUtils.changes(args.db, null, null, null, null, false,
        'other-user-uuid');
    }).then(function (chngs) {
      testUtils.contains([{
        name: 'priority'
      }], testUtils.sortChanges(chngs));
    });
  });

  it('should include doc when all can read and not authenticated', function () {
    var changes = [{
      col: 'task',
      id: '1',
      name: 'priority',
      val: '"high"',
      up: '2014-01-01T10:00:00.000Z',
      uid: userUtils.userUUID
    }];

    return queueAndProcess(changes).then(function () {
      return testUtils.changes(args.db, null, null, null, null, false, null);
    }).then(function (chngs) {
      testUtils.contains([{
        name: 'priority'
      }], testUtils.sortChanges(chngs));
    });
  });

  it('should include attr when all can read and authenticated but not owner', function () {
    var changes = [{
      col: 'task',
      id: '1',
      name: 'priority',
      val: '"high"',
      up: '2014-01-01T10:00:00.000Z',
      uid: userUtils.userUUID
    }];

    var policy = {
      col: {
        read: '$all'
      }
    };

    return queueAndProcess(changes).then(function () {
      return userUtils.setPolicy(policy);
    }).then(function () {
      return testUtils.changes(args.db, null, null, null, null, false,
        'other-user-uuid');
    }).then(function (chngs) {
      testUtils.contains([{
        name: 'priority'
      }], testUtils.sortChanges(chngs));
    });
  });

  it('should include attr when all can read and not authenticated', function () {
    var changes = [{
      col: 'task',
      id: '1',
      name: 'priority',
      val: '"high"',
      up: '2014-01-01T10:00:00.000Z',
      uid: userUtils.userUUID
    }];

    var policy = {
      col: {
        read: '$all'
      }
    };

    return queueAndProcess(changes).then(function () {
      return userUtils.setPolicy(policy);
    }).then(function () {
      return testUtils.changes(args.db, null, null, null, null, false, null);
    }).then(function (chngs) {
      testUtils.contains([{
        name: 'priority'
      }], testUtils.sortChanges(chngs));
    });
  });

  it('should omit doc read if role missing', function () {
    var changes = [{
      col: 'task',
      id: '1',
      name: 'priority',
      val: '"high"',
      up: '2014-01-01T10:00:00.000Z',
      uid: userUtils.userUUID
    }];

    var policy = {
      col: {
        read: 'another-role'
      }
    };

    return queueAndProcess(changes).then(function () {
      return userUtils.setPolicy(policy);
    }).then(function () {
      return testUtils.changes(args.db, null, null, null, null, false,
        'other-user-uuid');
    }).then(function (chngs) {
      chngs.should.eql([]);
    }).then(function () {
      // Create user and try with this user as they don't have another-role
      return userUtils.createUser('other-user-uuid', 'otheruser', 'secret');
    }).then(function () {
      return testUtils.changes(args.db, null, null, null, null, false,
        'other-user-uuid');
    }).then(function (chngs) {
      chngs.should.eql([]);
    });
  });

  it('should omit doc read if db role missing', function () {
    var changes = [{
      col: 'task',
      id: '1',
      name: 'priority',
      val: '"high"',
      up: '2014-01-01T10:00:00.000Z',
      uid: userUtils.userUUID
    }];

    var policy = {
      col: {
        read: 'another-role'
      }
    };

    return queueAndProcess(changes).then(function () {
      return userUtils.setPolicy(policy, '$all'); // set db policy
    }).then(function () {
      return userUtils.setPolicy(policy); // set col policy
    }).then(function () {
      return testUtils.changes(args.db, null, null, null, null, false,
        'other-user-uuid');
    }).then(function (chngs) {
      chngs.should.eql([]);
    });
  });

  it('should omit doc read if not owner', function () {
    var changes = [{
      col: 'task',
      id: '1',
      name: 'priority',
      val: '"high"',
      up: '2014-01-01T10:00:00.000Z',
      uid: userUtils.userUUID
    }];

    var policy = {
      col: {
        read: '$owner'
      }
    };

    return queueAndProcess(changes).then(function () {
      return userUtils.setPolicy(policy);
    }).then(function () {
      return testUtils.changes(args.db, null, null, null, null, false,
        'other-user-uuid');
    }).then(function (chngs) {
      chngs.should.eql([]);
    });
  });

  it('should include doc read if no policy', function () {
    // Note: we cannot specify a uid as then the default policy will provide access to only that
    // user
    var changes = [{
      col: 'task',
      id: '1',
      name: 'priority',
      val: '"high"',
      up: '2014-01-01T10:00:00.000Z'
    }];

    return args.db.truncateDatabase().then(function () { // remove any policies
      return queueAndProcess(changes);
    }).then(function () {
      return testUtils.changes(args.db, null, null, null, null, false,
        'other-user-uuid');
    }).then(function (chngs) {
      testUtils.contains([{
        name: 'priority'
      }], testUtils.sortChanges(chngs));
    });
  });

  it('should include doc read if have role', function () {
    var changes = [{
      col: 'task',
      id: '1',
      name: 'priority',
      val: '"high"',
      up: '2014-01-01T10:00:00.000Z',
      uid: userUtils.userUUID
    }];

    var policy = {
      col: {
        read: 'a-role'
      }
    };

    return queueAndProcess(changes).then(function () {
      return userUtils.setPolicy(policy);
    }).then(function () {
      return userUtils.createUser('other-user-uuid', 'otheruser', 'secret');
    }).then(function () {
      return userUtils.addUserRole('other-user-uuid', 'a-role');
    }).then(function () {
      return testUtils.changes(args.db, null, null, null, null, false,
        'other-user-uuid');
    }).then(function (chngs) {
      testUtils.contains([{
        name: 'priority'
      }], testUtils.sortChanges(chngs));
    });
  });

  it('should omit doc read if user disabled', function () {
    var changes = [{
      col: 'task',
      id: '1',
      name: 'priority',
      val: '"high"',
      up: '2014-01-01T10:00:00.000Z',
      uid: userUtils.userUUID
    }];

    var policy = {
      col: {
        read: 'a-role'
      }
    };

    return queueAndProcess(changes).then(function () {
      return userUtils.setPolicy(policy);
    }).then(function () {
      return userUtils.createUser('other-user-uuid', 'otheruser', 'secret', 'disabled');
    }).then(function () {
      return userUtils.addUserRole('other-user-uuid', 'a-role');
    }).then(function () {
      return testUtils.changes(args.db, null, null, null, null, false,
        'other-user-uuid');
    }).then(function (chngs) {
      chngs.should.eql([]);
    });
  });

  it('should should include doc read if owner', function () {
    var changes = [{
      col: 'task',
      id: '1',
      name: 'priority',
      val: '"high"',
      up: '2014-01-01T10:00:00.000Z',
      uid: userUtils.userUUID
    }];

    var policy = {
      col: {
        read: '$owner'
      }
    };

    return queueAndProcess(changes).then(function () {
      return userUtils.setPolicy(policy);
    }).then(function () {
      return testUtils.changes(args.db, null, null, null, null, false, userUtils.userUUID);
    }).then(function (chngs) {
      testUtils.contains([{
        name: 'priority'
      }], testUtils.sortChanges(chngs));
    });
  });

  it('should omit attr read if role missing', function () {
    var changes = [{
      col: 'task',
      id: '1',
      name: 'priority',
      val: '"high"',
      up: '2014-01-01T10:00:00.000Z',
      uid: userUtils.userUUID
    }];

    var policy = {
      attrs: {
        priority: {
          read: 'another-role'
        }
      }
    };

    return queueAndProcess(changes).then(function () {
      return userUtils.setPolicy(policy);
    }).then(function () {
      return testUtils.changes(args.db, null, null, null, null, false,
        'other-user-uuid');
    }).then(function (chngs) {
      chngs.should.eql([]);
    });
  });

  it('should omit attr read if db role missing', function () {
    var changes = [{
      col: 'task',
      id: '1',
      name: 'priority',
      val: '"high"',
      up: '2014-01-01T10:00:00.000Z',
      uid: userUtils.userUUID
    }];

    var policy = {
      attrs: {
        priority: {
          read: 'another-role'
        }
      }
    };

    return queueAndProcess(changes).then(function () {
      return userUtils.setPolicy(policy, '$all'); // set db policy
    }).then(function () {
      return userUtils.setPolicy(policy); // set col policy
    }).then(function () {
      return testUtils.changes(args.db, null, null, null, null, false,
        'other-user-uuid');
    }).then(function (chngs) {
      chngs.should.eql([]);
    });
  });

  it('should omit attr read if not owner', function () {
    var changes = [{
      col: 'task',
      id: '1',
      name: 'priority',
      val: '"high"',
      up: '2014-01-01T10:00:00.000Z',
      uid: userUtils.userUUID
    }];

    var policy = {
      attrs: {
        priority: {
          read: '$owner'
        }
      }
    };

    return queueAndProcess(changes).then(function () {
      return userUtils.setPolicy(policy);
    }).then(function () {
      return testUtils.changes(args.db, null, null, null, null, false,
        'other-user-uuid');
    }).then(function (chngs) {
      chngs.should.eql([]);
    });
  });

  it('should include attr read if have role', function () {
    var changes = [{
      col: 'task',
      id: '1',
      name: 'priority',
      val: '"high"',
      up: '2014-01-01T10:00:00.000Z',
      uid: userUtils.userUUID
    }];

    var policy = {
      attrs: {
        priority: {
          read: 'a-role'
        }
      }
    };

    return queueAndProcess(changes).then(function () {
      return userUtils.setPolicy(policy);
    }).then(function () {
      return userUtils.createUser('other-user-uuid', 'otheruser', 'secret');
    }).then(function () {
      return userUtils.addUserRole('other-user-uuid', 'a-role');
    }).then(function () {
      return testUtils.changes(args.db, null, null, null, null, false,
        'other-user-uuid');
    }).then(function (chngs) {
      testUtils.contains([{
        name: 'priority'
      }], testUtils.sortChanges(chngs));
    });
  });

  it('should omit attr read if user disabled', function () {
    var changes = [{
      col: 'task',
      id: '1',
      name: 'priority',
      val: '"high"',
      up: '2014-01-01T10:00:00.000Z',
      uid: userUtils.userUUID
    }];

    var policy = {
      attrs: {
        priority: {
          read: 'a-role'
        }
      }
    };

    return queueAndProcess(changes).then(function () {
      return userUtils.setPolicy(policy);
    }).then(function () {
      return userUtils.createUser('other-user-uuid', 'otheruser', 'secret', 'disabled');
    }).then(function () {
      return userUtils.addUserRole('other-user-uuid', 'a-role');
    }).then(function () {
      return testUtils.changes(args.db, null, null, null, null, false,
        'other-user-uuid');
    }).then(function (chngs) {
      chngs.should.eql([]);
    });
  });

  it('should should include attr read if owner', function () {
    var changes = [{
      col: 'task',
      id: '1',
      name: 'priority',
      val: '"high"',
      up: '2014-01-01T10:00:00.000Z',
      uid: userUtils.userUUID
    }];

    var policy = {
      attrs: {
        priority: {
          read: '$owner'
        }
      }
    };

    return queueAndProcess(changes).then(function () {
      return userUtils.setPolicy(policy);
    }).then(function () {
      return testUtils.changes(args.db, null, null, null, null, false, userUtils.userUUID);
    }).then(function (chngs) {
      testUtils.contains([{
        name: 'priority'
      }], testUtils.sortChanges(chngs));
    });
  });

  it('should permit attr read if super and role missing', function () {
    var changes = [{
      col: 'task',
      id: '1',
      name: 'priority',
      val: '"high"',
      up: '2014-01-01T10:00:00.000Z',
      uid: userUtils.userUUID
    }];

    var policy = {
      col: {
        read: 'another-role'
      },
      attrs: {
        priority: {
          read: 'another-role'
        }
      }
    };

    return queueAndProcess(changes).then(function () {
      return userUtils.setPolicy(policy); // set policy
    }).then(function () {
      return testUtils.changes(args.db, null, null, null, null, false, '$super');
    }).then(function (chngs) {
      testUtils.contains([{
        name: 'priority'
      }], testUtils.sortChanges(chngs));
    });
  });

  it('should include doc when no author and authenticated', function () {
    var changes = [{
      col: 'task',
      id: '1',
      name: 'priority',
      val: '"high"',
      up: '2014-01-01T10:00:00.000Z'
    }];

    return queueAndProcess(changes).then(function () {
      return testUtils.changes(args.db, null, null, null, null, false, 'user-uuid');
    }).then(function (chngs) {
      testUtils.contains([{
        name: 'priority'
      }], testUtils.sortChanges(chngs));
    });
  });

});
