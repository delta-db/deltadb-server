'use strict';

// --- BEGIN TMP COMMENTS

// ALL EVENTS:
// DONE: * attr:create: attr created
// DONE: * attr:update: attr updated
// DONE: * attr:destroy: attr destroyed
// DONE: * attr:record: attr recorded: create, update, destroy
// DONE: * doc:create: doc created
// DONE: * doc:update: attr updated
// DONE: * doc:destroy: doc destroyed
// DONE: * doc:record: doc record
// DONE: * col:create
// * col:update: col updated
// * col:destroy: col destroyed
// * col:record:
// * db:create:
// * db:update: db updated
// * db:destroy: db destroyed
// * db:record


// DOC:
// * attr:create: attr created
// * attr:update: attr updated
// * attr:destroy: attr destroyed
// * attr:record: attr recorded
// * doc:create:
// * doc:update: attr updated
// * doc:destroy: doc destroyed
// * doc:record: doc record

// COL:
// * ALL ABOVE
// * doc:create: doc created
// * col:update: col updated
// * col:destroy: col destroyed
// * col:record:

// DB:
// * ALL ABOVE
// * col:create: col created
// * db:update: db updated
// * db:destroy: db destroyed
// * db:record

// NODE:
// * ALL ABOVE
// * db:create


// TODO: (make sure to test cases when already exists or was recorded, etc..)
// TODO: need to adjust event name based on receiving layer, e.g. doc may have been created,
//       but col already exists
//  create: when client creates
//          when server creates (only if not local)
//  update: when client updates
//          server updates (only if changes data)
//  destroy: when client destroys
//           server destroys (only if actually destroys locally)
//  record: if not already recorded and change is recorded by server

// ---- END TMP COMMENTS

// TODO: error event?

// TODO: split tests up by event

var utils = require('../../../scripts/utils'),
  testUtils = require('../../utils'),
  MemAdapter = require('../../../scripts/orm/nosql/adapters/mem'),
  Client = require('../../../scripts/client/adapter');

describe('events', function () {

  var store = new MemAdapter();
  var client = new Client(store);
  var db = null,
    tasks = null,
    task = null;

  beforeEach(function () {
    return client.connect({
      db: 'mydb'
    }).then(function (_db) {
      db = _db;
      return db.use('tasks');
    }).then(function (collection) {
      tasks = collection;
      task = tasks.define();
      task.id('1');
    });
  });

  var Server = function (changes) {
    this.queue = function () {};

    this.changes = function () {
      return changes;
    };
  };

  var now = new Date(),
    nowStr = now.toISOString(),
    before = new Date('2015-01-01'),
    beforeStr = before.toISOString(),
    later = new Date(now.getTime() + 1),
    laterStr = later.toISOString();

  var eventArgsShouldEql = function (args, id, name, value) {
    args[0].should.eql({
      name: name,
      value: value
    });
    args[1].id().should.eql(id);
  };

  var createLocalShouldEql = function (args) {
    eventArgsShouldEql(args, '1', 'priority', 'low');
  };

  var createRemoteShouldEql = function (args) {
    eventArgsShouldEql(args, '1', 'thing', 'sing');
  };

  // -----

  var createLocal = function () {
    task._set('priority', 'low', now); // use _set so we can force a timestamp
    return task.save(); // item not registered with collection until save()
  };

  var attrShouldCreateLocal = function (emitter) {
    return testUtils.shouldDoAndOnce(createLocal, emitter, 'attr:create').then(function (args) {
      createLocalShouldEql(args);
    });
  };

  it('doc: attr:create local', function () {
    attrShouldCreateLocal(task);
  });

  it('col: attr:create local', function () {
    attrShouldCreateLocal(tasks);
  });

  it('db: attr:create local', function () {
    attrShouldCreateLocal(db);
  });

  it('client: attr:create local', function () {
    attrShouldCreateLocal(client);
  });

  var createRemote = function () {
    var server = new Server([{
      id: '1',
      col: 'tasks',
      name: 'thing',
      val: '"sing"',
      seq: 0,
      up: nowStr,
      re: nowStr
    }]);
    return db.sync(server, true);
  };

  var attrShouldCreateRemote = function (emitter) {
    return utils.doAndOnce(createLocal, emitter, 'attr:create').then(function () {
      return testUtils.shouldDoAndOnce(createRemote, emitter, 'attr:create');
    }).then(function (args) {
      createRemoteShouldEql(args);
    });
  };

  it('doc: attr:create remote', function () {
    return attrShouldCreateRemote(task);
  });

  it('col: attr:create remote', function () {
    return attrShouldCreateRemote(tasks);
  });

  it('db: attr:create remote', function () {
    return attrShouldCreateRemote(db);
  });

  it('client: attr:create remote', function () {
    return attrShouldCreateRemote(client);
  });

  var createRemoteSame = function () {
    var server = new Server([{
      id: '1',
      col: 'tasks',
      name: 'priority',
      val: '"low"',
      seq: 0,
      up: nowStr,
      re: nowStr
    }]);
    return db.sync(server, true);
  };

  var attrShouldCreateRemoteSame = function (emitter) {
    return utils.doAndOnce(createLocal, emitter, 'attr:create').then(function () {
      return testUtils.shouldDoAndNotOnce(createRemoteSame, emitter, 'attr:create');
    });
  };

  it('doc: attr:create remote same', function () {
    // TODO: does this one test cover the code path for all events?
    // TODO: better to just test all cases of Item._event?? Probably!
    return attrShouldCreateRemoteSame(task);
  });

  var createRemoteEarlier = function () {
    var server = new Server([{
      id: '1',
      col: 'tasks',
      name: 'priority',
      val: '"low"',
      seq: 0,
      up: beforeStr,
      re: beforeStr
    }]);
    return db.sync(server, true);
  };

  var attrShouldCreateRemoteEarlier = function (emitter) {
    return utils.doAndOnce(createLocal, emitter, 'attr:create').then(function () {
      return testUtils.shouldDoAndNotOnce(createRemoteEarlier, emitter, 'attr:create');
    });
  };

  it('doc: attr:create remote earlier', function () {
    // TODO: does this one test cover the code path for all events?
    // TODO: better to just test all cases of Item._event?? Probably!
    return attrShouldCreateRemoteEarlier(task);
  });

  // ------------------------

  var updateLocal = function () {
    return testUtils.timeout(1).then(function () { // sleep so update is after create
      task.set({
        'priority': 'high'
      }); // use _set so we can force a timestamp
    });
  };

  var updateShouldEql = function (args) {
    eventArgsShouldEql(args, '1', 'priority', 'high');
  };

  var attrShouldUpdateLocal = function (emitter) {
    return utils.doAndOnce(createLocal, emitter, 'attr:create').then(function () {
      return testUtils.shouldDoAndOnce(updateLocal, emitter, 'attr:update');
    }).then(function (args) {
      updateShouldEql(args);
    });
  };

  it('doc: attr:update local', function () {
    return attrShouldUpdateLocal(task);
  });

  it('col: attr:update local', function () {
    return attrShouldUpdateLocal(tasks);
  });

  it('db: attr:update local', function () {
    return attrShouldUpdateLocal(db);
  });

  it('client: attr:update local', function () {
    return attrShouldUpdateLocal(client);
  });

  var updateRemote = function () {
    var server = new Server([{
      id: '1',
      col: 'tasks',
      name: 'priority',
      val: '"high"',
      seq: 0,
      up: laterStr,
      re: laterStr
    }]);
    return db.sync(server, true);
  };

  var attrShouldUpdateRemote = function (emitter) {
    return utils.doAndOnce(createLocal, emitter, 'attr:create').then(function () {
      return testUtils.shouldDoAndOnce(updateRemote, emitter, 'attr:update');
    }).then(function (args) {
      updateShouldEql(args);
    });
  };

  it('doc: attr:update remote', function () {
    return attrShouldUpdateRemote(task);
  });

  it('col: attr:update remote', function () {
    return attrShouldUpdateRemote(tasks);
  });

  it('db: attr:update remote', function () {
    return attrShouldUpdateRemote(db);
  });

  it('client: attr:update remote', function () {
    return attrShouldUpdateRemote(client);
  });

  // ------------------------

  var destroyLocal = function () {
    return testUtils.timeout(1).then(function () { // sleep so destroy is after create
      task.unset('priority'); // use _set so we can force a timestamp
    });
  };

  var attrShouldDestroyLocal = function (emitter) {
    return utils.doAndOnce(createLocal, emitter, 'attr:create').then(function () {
      return testUtils.shouldDoAndOnce(destroyLocal, emitter, 'attr:destroy');
    }).then(function (args) {
      createLocalShouldEql(args);
    });
  };

  it('doc: attr:destroy local', function () {
    return attrShouldDestroyLocal(task);
  });

  it('col: attr:destroy local', function () {
    return attrShouldDestroyLocal(tasks);
  });

  it('db: attr:destroy local', function () {
    return attrShouldDestroyLocal(db);
  });

  it('client: attr:destroy local', function () {
    return attrShouldDestroyLocal(client);
  });

  var destroyRemote = function () {
    var server = new Server([{
      id: '1',
      col: 'tasks',
      name: 'priority',
      val: null,
      seq: 0,
      up: laterStr,
      re: laterStr
    }]);

    return testUtils.timeout(1).then(function () { // sleep so destroy is after create
      return db.sync(server, true);
    });
  };

  var attrShouldDestroyRemote = function (emitter) {
    return utils.doAndOnce(createLocal, emitter, 'attr:create').then(function () {
      return testUtils.shouldDoAndOnce(destroyRemote, emitter, 'attr:destroy');
    }).then(function (args) {
      createLocalShouldEql(args);
    });
  };

  it('doc: attr:destroy remote', function () {
    return attrShouldDestroyRemote(task);
  });

  it('col: attr:destroy remote', function () {
    return attrShouldDestroyRemote(tasks);
  });

  it('db: attr:destroy remote', function () {
    return attrShouldDestroyRemote(db);
  });

  it('client: attr:destroy remote', function () {
    return attrShouldDestroyRemote(client);
  });

  // ------------------------

  var recordRemote = function () {
    var server = new Server([{
      id: '1',
      col: 'tasks',
      name: 'priority',
      val: '"low"',
      seq: 0,
      up: nowStr,
      re: laterStr
    }]);

    return testUtils.timeout(1).then(function () { // sleep so record is after create
      return db.sync(server, true);
    });
  };

  var attrShouldRecord = function (emitter) {
    return utils.doAndOnce(createLocal, emitter, 'attr:create').then(function () {
      return testUtils.shouldDoAndOnce(recordRemote, emitter, 'attr:record');
    }).then(function (args) {
      createLocalShouldEql(args);
    });
  };

  it('doc: attr:record', function () {
    return attrShouldRecord(task);
  });

  it('col: attr:record', function () {
    return attrShouldRecord(tasks);
  });

  it('db: attr:record', function () {
    return attrShouldRecord(db);
  });

  it('client: attr:record', function () {
    return attrShouldRecord(client);
  });

  // ------------------------

  var docCreateShouldEql = function (args) {
    eventArgsShouldEql(args, '1', '$id', '1');
  };

  var docShouldCreateLocal = function (emitter) {
    return testUtils.shouldDoAndOnce(createLocal, emitter, 'doc:create').then(function (args) {
      docCreateShouldEql(args);
    });
  };

  it('doc: doc:create local', function () {
    return docShouldCreateLocal(task);
  });

  it('col: doc:create local', function () {
    return docShouldCreateLocal(tasks);
  });

  it('db: doc:create local', function () {
    return docShouldCreateLocal(db);
  });

  it('client: doc:create local', function () {
    return docShouldCreateLocal(client);
  });

  var docShouldCreateRemote = function (emitter) {
    return testUtils.shouldDoAndOnce(createRemote, emitter, 'doc:create').then(function (args) {
      docCreateShouldEql(args);
    });
  };

  it('doc: doc:create remote already local', function () {
    // Note: cannot receive doc:create event for doc that hasn't yet been created
    return utils.doAndOnce(createLocal, task, 'attr:create').then(function () {
      // Assert doc:create not received as already created
      return testUtils.shouldDoAndNotOnce(createRemote, task, 'doc:create');
    });
  });

  it('col: doc:create remote', function () {
    return docShouldCreateRemote(tasks);
  });

  it('db: doc:create remote', function () {
    return docShouldCreateRemote(db);
  });

  it('client: doc:create remote', function () {
    return docShouldCreateRemote(client);
  });

  // ------------------------

  var docShouldUpdateLocal = function (emitter) {
    return testUtils.shouldDoAndOnce(updateLocal, emitter, 'doc:update').then(function (args) {
      updateShouldEql(args);
    });
  };

  it('doc: doc:update local', function () {
    return docShouldUpdateLocal(task);
  });

  it('col: doc:update local', function () {
    return docShouldUpdateLocal(tasks);
  });

  it('db: doc:update local', function () {
    return docShouldUpdateLocal(db);
  });

  it('client: doc:update local', function () {
    return docShouldUpdateLocal(client);
  });

  var docShouldUpdateRemote = function (emitter) {
    return utils.doAndOnce(createLocal, emitter, 'doc:create').then(function () {
      return testUtils.shouldDoAndOnce(updateRemote, emitter, 'doc:update');
    }).then(function (args) {
      updateShouldEql(args);
    });
  };

  it('doc: doc:update remote', function () {
    return docShouldUpdateRemote(task);
  });

  it('col: doc:update remote', function () {
    return docShouldUpdateRemote(tasks);
  });

  it('db: doc:update remote', function () {
    return docShouldUpdateRemote(db);
  });

  it('client: doc:update remote', function () {
    return docShouldUpdateRemote(client);
  });

  // ------------------------

  var docDestroyShouldEql = function (args) {
    eventArgsShouldEql(args, '1', null, null);
  };

  var destroyDocLocal = function () {
    return testUtils.timeout(1).then(function () { // sleep so destroy is after create
      return task.destroy();
    });
  };

  var docShouldDestroyLocal = function (emitter) {
    return utils.doAndOnce(createLocal, emitter, 'attr:create').then(function () {
      return testUtils.shouldDoAndOnce(destroyDocLocal, emitter, 'doc:destroy');
    }).then(function (args) {
      docDestroyShouldEql(args);
    });
  };

  it('doc: doc:destroy local', function () {
    return docShouldDestroyLocal(task);
  });

  it('col: doc:destroy local', function () {
    return docShouldDestroyLocal(tasks);
  });

  it('db: doc:destroy local', function () {
    return docShouldDestroyLocal(db);
  });

  it('client: doc:destroy local', function () {
    return docShouldDestroyLocal(client);
  });

  var destroyDocRemote = function () {
    var server = new Server([{
      id: '1',
      col: 'tasks',
      name: null,
      val: null,
      seq: 0,
      up: laterStr,
      re: laterStr
    }]);

    return testUtils.timeout(1).then(function () { // sleep so destroy is after create
      return db.sync(server, true);
    });
  };

  var docShouldDestroyRemote = function (emitter) {
    return utils.doAndOnce(createLocal, emitter, 'attr:create').then(function () {
      return testUtils.shouldDoAndOnce(destroyDocRemote, emitter, 'doc:destroy');
    }).then(function (args) {
      docDestroyShouldEql(args);
    });
  };

  it('doc: doc:destroy remote', function () {
    return docShouldDestroyRemote(task);
  });

  it('col: doc:destroy remote', function () {
    return docShouldDestroyRemote(tasks);
  });

  it('db: doc:destroy remote', function () {
    return docShouldDestroyRemote(db);
  });

  it('client: doc:destroy remote', function () {
    return docShouldDestroyRemote(client);
  });

  // ------------------------

  var docShouldRecord = function (emitter) {
    return utils.doAndOnce(createLocal, emitter, 'doc:create').then(function () {
      return testUtils.shouldDoAndOnce(recordRemote, emitter, 'doc:record');
    }).then(function (args) {
      createLocalShouldEql(args);
    });
  };

  it('doc: doc:record', function () {
    return docShouldRecord(task);
  });

  it('col: doc:record', function () {
    return docShouldRecord(tasks);
  });

  it('db: doc:record', function () {
    return docShouldRecord(db);
  });

  it('client: doc:record', function () {
    return docShouldRecord(client);
  });

  // ------------------------

  var tasks2 = null;

  var colCreateShouldEql = function (args) {
    args[0].should.eql(tasks2);
  };

  var colCreateLocal = function () {
    return db.use('tasks2').then(function (_tasks2) {
      tasks2 = _tasks2;
    });
  };

  var colShouldCreateLocal = function (emitter) {
    return testUtils.shouldDoAndOnce(colCreateLocal, emitter, 'col:create').then(function (
      args) {
      colCreateShouldEql(args);
    });
  };

  // Note: no col:create at col layer as col:create emitted immediately after db.use()

  it('db: col:create local', function () {
    return colShouldCreateLocal(db);
  });

  it('client: col:create local', function () {
    return colShouldCreateLocal(client);
  });

  var colCreateRemote = function () {
    var server = new Server([{
      id: '2',
      col: 'tasks2',
      name: 'thing',
      val: '"sing"',
      seq: 0,
      up: nowStr,
      re: nowStr
    }]);
    return db.sync(server, true);
  };

  var colShouldCreateRemote = function (emitter) {
    return testUtils.shouldDoAndOnce(colCreateRemote, emitter, 'col:create').then(function (
      args) {
      return args[0].at('2');
    }).then(function (doc) {
      var obj = doc.get();
      obj.thing.should.eql('sing');
    });
  };

  it('db: col:create remote', function () {
    return colShouldCreateRemote(db);
  });

  it('client: col:create remote', function () {
    return colShouldCreateRemote(client);
  });

});