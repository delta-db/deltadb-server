'use strict';

// TODO: throw exception when errors in changes formatting

var partUtils = require('../utils');

describe('basic', function () {

  var args = partUtils.init(this, beforeEach, afterEach, null, before, after);
  var testUtils = args.utils;

  var queueAndProcess = function (changes) {
    // Force quorum=true. We don't need to consider quorum when getting changes as only changes
    // recorded by quorum are added to LATEST and server downloads all changes regardless of quorum
    // status.
    return testUtils.queueAndProcess(args.db, changes, true);
  };

  var changesNoDel = [{
    col: 'task',
    id: '123',
    name: 'thing',
    val: '"write a song"',
    up: '2014-01-01T10:00:00.000Z'
  }, {
    col: 'task',
    id: '123',
    name: 'priority',
    val: '"medium"',
    up: '2014-01-01T10:00:00.000Z'
  }, {
    col: 'task',
    id: '123',
    name: 'priority',
    val: '"high"',
    up: '2014-01-01T10:01:00.000Z'
  }];

  var changesWithDel = [{
    col: 'task',
    id: '123',
    name: 'thing',
    val: '"write a song"',
    up: '2014-01-01T10:00:00.000Z'
  }, {
    col: 'task',
    id: '123',
    name: 'thing',
    up: '2014-01-01T10:01:00.000Z'
  }, {
    col: 'task',
    id: '123',
    name: 'priority',
    val: '"medium"',
    up: '2014-01-01T10:00:00.000Z'
  }, {
    col: 'task',
    id: '123',
    name: 'priority',
    val: '"high"',
    up: '2014-01-01T10:01:00.000Z'
  }, {
    col: 'task',
    id: '123',
    up: '2014-01-01T10:02:00.000Z'
  }];

  // Note: the client only needs the latest values, but the server needs a complete history

  var changesShouldEqlChangesNoDel = function (chngs) {
    testUtils.changesShouldEql(
      [{
        id: '123',
        col: 'task',
        name: 'priority',
        val: '"medium"',
        up: '2014-01-01T10:00:00.000Z'
      }, {
        id: '123',
        col: 'task',
        name: 'priority',
        val: '"high"',
        up: '2014-01-01T10:01:00.000Z'
      }, {
        id: '123',
        col: 'task',
        name: 'thing',
        val: '"write a song"',
        up: '2014-01-01T10:00:00.000Z'
      }], chngs);
  };

  var changesShouldEqlChangesWithDel = function (chngs) {
    testUtils.changesShouldEql(
      [{
        id: '123',
        col: 'task',
        name: 'priority',
        val: '"medium"',
        up: '2014-01-01T10:00:00.000Z'
      }, {
        id: '123',
        col: 'task',
        name: 'priority',
        val: '"high"',
        up: '2014-01-01T10:01:00.000Z'
      }, {
        id: '123',
        col: 'task',
        name: 'thing',
        val: '"write a song"',
        up: '2014-01-01T10:00:00.000Z'
      }, {
        id: '123',
        col: 'task',
        name: 'thing',
        up: '2014-01-01T10:01:00.000Z'
      }, {
        id: '123',
        col: 'task',
        up: '2014-01-01T10:02:00.000Z'
      }], chngs);
  };

  it('client: should get changes from initial sync', function () {
    return queueAndProcess(changesNoDel).then(function () {
      return args.db.changes();
    }).then(function (chngs) {
      testUtils.changesShouldEql(
        [{
          id: '123',
          col: 'task',
          name: 'priority',
          val: '"high"',
          up: '2014-01-01T10:01:00.000Z'
        }, {
          id: '123',
          col: 'task',
          name: 'thing',
          val: '"write a song"',
          up: '2014-01-01T10:00:00.000Z'
        }], chngs);
    });
  });

  it('server: should get changes from initial sync', function () {
    return queueAndProcess(changesNoDel).then(function () {
      return args.db.changes(null, true);
    }).then(function (chngs) {
      changesShouldEqlChangesNoDel(chngs);
    });
  });

  it('client: should get changes with deletions from initial sync', function () {
    return queueAndProcess(changesWithDel).then(function () {
      return args.db.changes();
    }).then(function (chngs) {
      testUtils.changesShouldEql(
        [{
          id: '123',
          col: 'task',
          name: 'priority',
          val: '"high"',
          up: '2014-01-01T10:01:00.000Z'
        }, {
          id: '123',
          col: 'task',
          name: 'thing',
          up: '2014-01-01T10:01:00.000Z'
        }, {
          id: '123',
          col: 'task',
          up: '2014-01-01T10:02:00.000Z'
        }], chngs);
    });
  });

  it('server: should get changes with deletions from initial sync', function () {
    return queueAndProcess(changesWithDel).then(function () {
      return args.db.changes(null, true);
    }).then(function (chngs) {
      changesShouldEqlChangesWithDel(chngs);
    });
  });

  it('client: should get recent changes', function () {
    var since = new Date();
    return queueAndProcess(changesNoDel).then(function () {
      return args.db.changes(since);
    }).then(function (chngs) {
      testUtils.changesShouldEql(
        [{
          id: '123',
          col: 'task',
          name: 'priority',
          val: '"high"',
          up: '2014-01-01T10:01:00.000Z'
        }, {
          id: '123',
          col: 'task',
          name: 'thing',
          val: '"write a song"',
          up: '2014-01-01T10:00:00.000Z'
        }], chngs);
    }).then(function () {
      return testUtils.sleep(); // ensure next changes called at least 1 ms after process
    }).then(function () {
      since = new Date();
      return queueAndProcess(
        [{
          col: 'task',
          id: '123',
          name: 'priority',
          val: '"low"',
          up: '2014-01-01T09:00:00.000Z'
        }]);
    }).then(function () {
      return args.db.changes(since);
    }).then(function (chngs) {
      // client only gets latest recent changes
      chngs.should.eql([]);
    });
  });

  it('server: should get recent changes', function () {
    var since = new Date();
    return queueAndProcess(changesNoDel).then(function () {
      return args.db.changes(since, true);
    }).then(function (chngs) {
      changesShouldEqlChangesNoDel(chngs);
    }).then(function () {
      return testUtils.sleep(); // ensure next changes called at least 1 ms after process
    }).then(function () {
      since = new Date();
      return queueAndProcess(
        [{
          col: 'task',
          id: '123',
          name: 'priority',
          val: '"low"',
          up: '2014-01-01T09:00:00.000Z'
        }]);
    }).then(function () {
      return args.db.changes(since, true);
    }).then(function (chngs) {
      testUtils.changesShouldEql(
        [{
          id: '123',
          col: 'task',
          name: 'priority',
          val: '"low"',
          up: '2014-01-01T09:00:00.000Z'
        }], chngs);
    });
  });

  it('client: should get recent changes with deletions', function () {
    var since = new Date();
    return queueAndProcess(changesWithDel).then(function () {
      return testUtils.sleep(); // ensure changes called at least 1 ms after archive
    }).then(function () {
      return args.db.changes(since);
    }).then(function (chngs) {
      testUtils.changesShouldEql(
        [{
          id: '123',
          col: 'task',
          name: 'priority',
          val: '"high"',
          up: '2014-01-01T10:01:00.000Z'
        }, {
          id: '123',
          col: 'task',
          name: 'thing',
          up: '2014-01-01T10:01:00.000Z'
        }, {
          id: '123',
          col: 'task',
          up: '2014-01-01T10:02:00.000Z'
        }], chngs);
    }).then(function () {
      since = new Date();
      return queueAndProcess(
        [{
          col: 'task',
          id: '123',
          name: 'priority',
          val: '"low"',
          up: '2014-01-01T09:00:00.000Z'
        }]);
    }).then(function () {
      return args.db.changes(since);
    }).then(function (chngs) {
      chngs.should.eql([]); // del still latest
    });
  });

  it('server: should get recent changes with deletions', function () {
    var since = new Date();
    return queueAndProcess(changesWithDel).then(function () {
      return testUtils.sleep(); // ensure changes called at least 1 ms after archive
    }).then(function () {
      return args.db.changes(since, true);
    }).then(function (chngs) {
      changesShouldEqlChangesWithDel(chngs);
    }).then(function () {
      since = new Date();
      return queueAndProcess(
        [{
          col: 'task',
          id: '123',
          name: 'priority',
          val: '"low"',
          up: '2014-01-01T09:00:00.000Z'
        }]);
    }).then(function () {
      return args.db.changes(since, true);
    }).then(function (chngs) {
      testUtils.changesShouldEql(
        [{
          id: '123',
          col: 'task',
          name: 'priority',
          val: '"low"',
          up: '2014-01-01T09:00:00.000Z'
        }], chngs);
    });
  });

  it('client: should get changes that are not recent', function () {
    var since = new Date();
    return queueAndProcess(changesNoDel).then(function () {
      return args.db.archive(new Date());
    }).then(function () {
      return args.db.changes(since);
    }).then(function (chngs) {
      testUtils.changesShouldEql([changesNoDel[2], changesNoDel[0]], chngs);
    });
  });

  it('server: should get changes that are not recent', function () {
    var since = new Date();
    return queueAndProcess(changesNoDel).then(function () {
      return args.db.archive(new Date());
    }).then(function () {
      return args.db.changes(since, true);
    }).then(function (chngs) {
      changesShouldEqlChangesNoDel(chngs);
    });
  });

  it('client: should get changes with deletions that are not recent', function () {
    return queueAndProcess(changesWithDel).then(function () {
      return args.db.archive(new Date());
    }).then(function () {
      return args.db.changes();
    }).then(function (chngs) {
      testUtils.changesShouldEql(
        [{
          id: '123',
          col: 'task',
          name: 'priority',
          val: '"high"',
          up: '2014-01-01T10:01:00.000Z'
        }, {
          id: '123',
          col: 'task',
          name: 'thing',
          up: '2014-01-01T10:01:00.000Z'
        }, {
          id: '123',
          col: 'task',
          up: '2014-01-01T10:02:00.000Z'
        }], chngs);
    });
  });

  it('server: should get changes with deletions that are not recent', function () {
    var beforeProcess = new Date(),
      afterProcess = null;
    return testUtils.sleep().then(function () { // ensure beforeProcess 1 ms before process
      return queueAndProcess(changesWithDel);
    }).then(function () {
      return testUtils.sleep(); // ensure archive called at least 1 ms after processing changes
    }).then(function () {
      afterProcess = new Date();
      return args.db.archive(new Date());
    }).then(function () {
      return args.db.changes(beforeProcess, true);
    }).then(function (chngs) {
      changesShouldEqlChangesWithDel(chngs);
    }).then(function () {
      return args.db.changes(afterProcess, true);
    }).then(function (chngs) {
      chngs.should.eql([]);
    });
  });

  it('client: should get updates for destroyed docs', function () {
    var beforeProcess = new Date();
    var changes = [{
      col: 'task',
      id: '1',
      name: 'priority',
      val: '"high"',
      up: '2014-01-01T10:00:00.300Z'
    }, {
      col: 'task',
      id: '1',
      up: '2014-01-01T10:20:00.300Z'
    }, {
      col: 'task',
      id: '1',
      name: 'priority',
      val: '"low"',
      up: '2014-01-01T10:01:00.300Z'
    }];
    return testUtils.sleep().then(function () { // ensure beforeProcess 1 ms before process
      return queueAndProcess(changes);
    }).then(function () {
      return args.db.changes(beforeProcess);
    }).then(function (chngs) {
      testUtils.changesShouldEql(
        [{
          id: '1',
          col: 'task',
          name: 'priority',
          val: '"low"',
          up: '2014-01-01T10:01:00.300Z'
        }, {
          id: '1',
          col: 'task',
          up: '2014-01-01T10:20:00.300Z'
        }], chngs);
    });
  });

});
