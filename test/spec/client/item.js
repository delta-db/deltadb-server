'use strict';

var MemAdapter = require('../../../scripts/orm/nosql/adapters/mem'),
  Client = require('../../../scripts/client/adapter'),
  Doc = require('../../../scripts/client/item');

describe('item', function () {

  var FakeDoc = function () {
    this.get = function () {
      return {};
    };
  };

  it('should record when remote change has seq', function () {
    var item = new Doc(new FakeDoc()),
      updated = new Date();

    item._changes = [{
      name: 'priority',
      val: 'high',
      up: updated,
      seq: 1
    }];

    item._record('priority', 'high', updated);
  });

  it('should set policy', function () {
    var store = new MemAdapter();
    var client = new Client(store);
    var db = null,
      tasks = null,
      task;

    var policy = {
      col: {
        read: 'somerole'
      }
    };

    // TODO: is there a better way to fake the underlying dependices so that we don't have to
    // connect(), col(), etc... just to get an item?

    db = client.db({
      db: 'mydb'
    });

    return db.col('tasks').then(function (collection) {
      tasks = collection;
    }).then(function () {
      return tasks.doc();
    }).then(function (doc) {
      task = doc;
      return task.policy(policy);
    }).then(function () {
      var doc = task.get();
      doc[Doc._policyName].should.eql(policy);
    });

  });

});