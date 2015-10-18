'use strict';

var testUtils = require('../../utils'),
  Client = require('../../../scripts/client/adapter'),
  Promise = require('bluebird');

describe('multiple', function () {

  var client1 = null,
    client2 = null;

  beforeEach(function () {
    client1 = new Client(true); // local only so no connection to server
    client2 = new Client(true); // local only so no connection to server
  });

  // Note: don't need afterEach as everything created in mem and therefore doesn't need to be purged

  it('should have unique event emitters', function () {

    // Note: the following test was failing with as Doc defined an attribute called "_events" which
    // was also in use by EventEmitter. TODO: to prevent this in the future, should Doc contain
    // EventEmitter and just provide access functions?

    var db1 = client1.db({
        db: 'mydb'
      }),
      db2 = client2.db({
        db: 'mydb'
      }),
      col1 = db1.col('mycol'),
      col2 = db2.col('mycol'),
      doc1 = col1.doc(),
      doc2 = col2.doc();

    var promiseFactory = function () {
      doc1.emit('test-event');
      return Promise.resolve();
    };

    return testUtils.shouldDoAndNotOnce(promiseFactory, doc2, 'test-event');
  });

});
