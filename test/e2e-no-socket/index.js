'use strict';

/* global before, after */

var utils = require('../utils'),
  Client = require('../../scripts/client/adapter'),
  partUtils = require('../spec/partitioner/sql/utils');

describe('e2e-no-socket', function () {

  var client = null,
    a = null,
    aTasks = null,
    b = null,
    bTasks = null;

  var args = partUtils.init(this, beforeEach, afterEach, false, before, after);

  beforeEach(function () {
    client = new Client(true);

    a = client.db({
      db: 'mydb'
    });

    b = client.db({
      db: 'mydb'
    });

    aTasks = a.col('tasks');
  });

  var syncAndProcess = function (localDB) {
    // quorum=true as we are simulating a single DB
    return localDB.sync(args.db, true).then(function () {
      return args.db.process();
    });
  };

  it('client: should perform initial sync', function () {
    var task1 = aTasks.doc({
      thing: 'write a song',
      priority: 'medium'
    });
    return task1.save().then(function () {
      return task1.set({
        priority: 'high'
      });
    }).then(function () {
      return syncAndProcess(a);
    }).then(function () {
      return syncAndProcess(b);
    }).then(function () {
      bTasks = b.col('tasks');
      return utils.allShouldEql(bTasks, [{
        $id: task1.id(),
        thing: 'write a song',
        priority: 'high'
      }]);
    });
  });

  it('client: should perform recent sync', function () {
    var task1 = aTasks.doc({
      thing: 'write a song',
      priority: 'medium'
    });
    return task1.save().then(function () {
      return syncAndProcess(a);
    }).then(function () {
      return syncAndProcess(b);
    }).then(function () {
      bTasks = b.col('tasks');
      return utils.allShouldEql(bTasks, [{
        $id: task1.id(),
        thing: 'write a song',
        priority: 'medium'
      }]);
    }).then(function () {
      return task1.set({
        priority: 'high'
      });
    }).then(function () {
      return syncAndProcess(a);
    }).then(function () {
      return syncAndProcess(b);
    }).then(function () {
      return utils.allShouldEql(bTasks, [{
        $id: task1.id(),
        thing: 'write a song',
        priority: 'high'
      }]);
    });
  });

  it('client: should perform non-recent sync', function () {
    var task1 = aTasks.doc({
      thing: 'write a song',
      priority: 'medium'
    });
    return b.sync(args.db, true).then(function () {
      return task1.save();
    }).then(function () {
      return syncAndProcess(a);
    }).then(function () {
      return args.db.archive(new Date());
    }).then(function () {
      return syncAndProcess(b);
    }).then(function () {
      bTasks = b.col('tasks');
      return utils.allShouldEql(bTasks, [{
        $id: task1.id(),
        thing: 'write a song',
        priority: 'medium'
      }]);
    });
  });

  it('client: should preserve latest change', function () {
    // a writes data
    // a syncs
    // b syncs - gets the data from a to b
    // a makes change
    // b makes change
    // b syncs
    // a syncs
    // a's and b's data should be change from b
    var task1 = aTasks.doc({
      thing: 'write a song',
      priority: 'medium'
    });
    return task1.save().then(function () {
      return syncAndProcess(a);
    }).then(function () {
      return syncAndProcess(b);
    }).then(function () {
      bTasks = b.col('tasks');
      return utils.allShouldEql(bTasks, [{
        $id: task1.id(),
        thing: 'write a song',
        priority: 'medium'
      }]);
    }).then(function () {
      return task1.set({
        priority: 'high'
      });
    }).then(function () {
      return utils.sleep(); // ensure following update not on same timestamp
    }).then(function () {
      return bTasks.get(task1.id());
    }).then(function (bTask1) {
      return bTask1.set({
        priority: 'low'
      });
    }).then(function () {
      return utils.sleep(); // ensure sync happens after last update
    }).then(function () {
      return syncAndProcess(b);
    }).then(function () {
      return syncAndProcess(a);
    }).then(function () {
      return utils.allShouldEql(aTasks, [{
        $id: task1.id(),
        thing: 'write a song',
        priority: 'low'
      }]);
    }).then(function () {
      return utils.allShouldEql(bTasks, [{
        $id: task1.id(),
        thing: 'write a song',
        priority: 'low'
      }]);
    });
  });

  it('client: should auto restore', function () {
    // Scenario:
    // a: creates { thing: 'write', priority: 'high' }
    // a: syncs
    // b: syncs
    // b: deletes doc
    // a: edits { priority: 'low' }
    // b: syncs
    // a: syncs in 1 yr => restore doc and apply changes
    var task1 = aTasks.doc({
      thing: 'write',
      priority: 'high'
    });
    return task1.save().then(function () {
      return syncAndProcess(a);
    }).then(function () {
      return syncAndProcess(b);
    }).then(function () {
      bTasks = b.col('tasks');
      return bTasks.get(task1.id());
    }).then(function (bTask1) {
      return bTask1.destroy();
    }).then(function () {
      // For the sake of this test, we need to guarantee that the deleting and restoring changes
      // happen at different times as deletions are given priority and we want to ensure that the
      // update happens after the delete
      return utils.timeout(10);
    }).then(function () {
      return task1.set({
        priority: 'medium'
      });
    }).then(function () {
      return utils.sleep(); // ensure update happens before sync
    }).then(function () {
      return syncAndProcess(b); // send del
    }).then(function () {
      return syncAndProcess(a); // send update
    }).then(function () {
      return syncAndProcess(a); // get auto restore
    }).then(function () {
      return syncAndProcess(b); // get auto restore
    }).then(function () {
      return utils.allShouldEql(aTasks, [{
        $id: task1.id(),
        thing: 'write',
        priority: 'medium'
      }]);
    }).then(function () {
      return utils.allShouldEql(bTasks, [{
        $id: task1.id(),
        thing: 'write',
        priority: 'medium'
      }]);
    });
  });

});
