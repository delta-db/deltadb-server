'use strict';

var Client = require('../../../scripts/client/adapter'),
  Doc = require('../../../scripts/client/doc');

describe('doc', function () {

  var client = null,
    db = null,
    tasks = null,
    task = null;

  beforeEach(function () {
    client = new Client(true);

    db = client.db({
      db: 'mydb'
    });

    tasks = db.col('tasks');

    task = tasks.doc();
  });

  it('should record when remote change has seq', function () {
    var updated = new Date();

    task._dat.changes = [{
      name: 'priority',
      val: 'high',
      up: updated,
      seq: 1
    }];

    task._record('priority', 'high', updated);
  });

  it('should set policy', function () {

    var policy = {
      col: {
        read: 'somerole'
      }
    };

    return task.policy(policy).then(function () {
      var doc = task.get();
      doc[Doc._policyName].should.eql(policy);
    });

  });

  it('should not format change', function () {
    // Exclude from changes when already sent
    var change = {
      sent: new Date()
    };
    var now = (new Date()).getTime() - 1;
    task._formatChange(0, null, null, change, now);
  });

  it('should get existing doc', function () {
    // Set task so that id is generated for future lookup
    return task.set({
      thing: 'sing'
    }).then(function () {
      var doc = tasks.doc(task.get());
      doc.should.eql(task);
    });
  });

});