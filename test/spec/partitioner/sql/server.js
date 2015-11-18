'use strict';

// TODO: only create/destroy db once and use truncation after each test

var testUtils = require('../../../utils'),
  DB = require('../../../../scripts/partitioner/sql'),
  Users = require('../../../../scripts/partitioner/sql/user/users');

describe('server', function () {

  testUtils.setUp(this);

  var a = null,
    b = null;

  var createDB = function (name) {
    var db = new DB(name);
    return db.createDatabase().then(function () {
      return db;
    });
  };

  beforeEach(function () {
    return createDB('testdb_a').then(function (db) {
      a = db;
      return createDB('testdb_b');
    }).then(function (db) {
      b = db;
    });
  });

  afterEach(function () {
    return a.destroyDatabase().then(function () {
      return b.destroyDatabase();
    });
  });

  var changes = [{
      col: 'task',
      id: '1',
      name: 'thing',
      val: '"write"',
      up: '2014-01-01T10:00:00.000Z'
    }, {
      col: 'task',
      id: '1',
      name: 'priority',
      val: '"medium"',
      up: '2014-01-01T10:00:00.000Z'
    }, {
      col: 'task',
      id: '1',
      name: 'priority',
      val: '"high"',
      up: '2014-01-01T10:01:00.000Z'
    },

    {
      col: 'task',
      id: '2',
      name: 'thing',
      val: '"sing"',
      up: '2014-01-01T10:01:00.000Z'
    }, {
      col: 'task',
      id: '2',
      up: '2014-01-01T10:02:00.000Z'
    }, // del doc

    {
      col: 'task',
      id: '3',
      name: 'thing',
      val: '"play"',
      up: '2014-01-01T10:02:00.000Z'
    }, {
      col: 'task',
      id: '3',
      name: 'priority',
      val: '"medium"',
      up: '2014-01-01T10:02:00.000Z'
    }, {
      col: 'task',
      id: '3',
      name: 'priority',
      up: '2014-01-01T10:03:00.000Z'
    }
  ]; // del attr

  var sync = function (from, to, since) { // server 2 server sync
    var changes = null;
    return testUtils.changes(from, since, true, null, null, null, Users.SUPER_UUID).then(
      function (
        chngs) {
        changes = chngs;
        return testUtils.queueAndProcess(to, chngs, true, Users.SUPER_UUID);
      }).then(function () {
      // NOTE: cannot just change quorum=true for all changes after sent to first server as the
      // changes may not reside in RECENT and then how would the quorum changes make their way to
      // RECENT? a needs to set quorum as soon as it writes to b, otherwise if the "loop" (e.g.
      // a->b->c->d->a) was large it would take a while for the quorum to be recorded
      return testUtils.queueAndProcess(from, changes, true, Users.SUPER_UUID);
    });
  };

  it('server should sync all changes with other server', function () {
    // Simulate loop, e.g. a->b->c->a or a->b->a
    var archived = null,
      since = new Date(),
      sinceFirstSync = null;
    return testUtils.sleep().then(function () {
      // Get changes before last archived, i.e. need to look at ALL
      archived = new Date();
    }).then(function () {
      return a.archive(archived); // initial archive
    }).then(function () {
      return b.archive(archived); // initial archive
    }).then(function () {
      return testUtils.sleep(); // delay so that since is not the same time as archived
    }).then(function () {
      return testUtils.queueAndProcess(a, changes); // populate a
    }).then(function () {
      return sync(a, b, since); // a syncs with b
    }).then(function () {
      return testUtils.sleep(); // delay so archive all changes
    }).then(function () {
      // Archive again so that next sync is also getting changes from ALL
      sinceFirstSync = new Date();
      return a.archive(sinceFirstSync);
    }).then(function () {
      return b.changes(since, true);
    }).then(function (chngs) {
      testUtils.changesShouldEql(changes, chngs); // b has changes?
    }).then(function () {
      return sync(b, a, since); // b syncs with a, e.g. end of "loop"
    }).then(function () {
      return a.changes(sinceFirstSync, true);
    }).then(function (chngs) {
      // make sure a reports no changes as we need to prevent an infinite recording loop
      chngs.should.eql([]);
    });
  });

  it('server should sync recent changes with other server', function () {
    // Simulate loop, e.g. a->b->c->a or a->b->a
    var archived = new Date(),
      since = null,
      sinceFirstSync = null;
    return a.archive(archived).then(function () { // archive so call to changes() returns recent
      return b.archive(archived); // archive so call to changes() returns recent
    }).then(function () {
      return testUtils.sleep(); // delay so that since is not the same time as archived
    }).then(function () {
      since = new Date();
      return testUtils.queueAndProcess(a, changes); // populate a
    }).then(function () {
      return sync(a, b, since); // a syncs with b
    }).then(function () {
      return testUtils.sleep(); // so sinceFirstSync is after 1st sync
    }).then(function () {
      sinceFirstSync = new Date();
      return b.changes(since, true);
    }).then(function (chngs) {
      testUtils.changesShouldEql(changes, chngs); // b has changes?
    }).then(function () {
      return sync(b, a, since); // b syncs with a, e.g. end of "loop"
    }).then(function () {
      return a.changes(sinceFirstSync, true);
    }).then(function (chngs) {
      // make sure a reports no changes as we need to prevent an infinite recording loop
      chngs.should.eql([]);
    });
  });

});
