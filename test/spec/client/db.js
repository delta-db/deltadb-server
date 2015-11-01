'use strict';

var DB = require('../../../scripts/client/db'),
  MemAdapter = require('../../../scripts/orm/nosql/adapters/mem'),
  Client = require('../../../scripts/client/adapter'),
  clientUtils = require('../../../scripts/client/utils'),
  commonUtils = require('../../common-utils'),
  utils = require('../../../scripts/utils'),
  MemAdapter = require('../../../scripts/orm/nosql/adapters/mem');

describe('db', function () {

  var db = null;

  afterEach(function () {
    if (db) {
      return db.destroy(true);
    }
  });

  it('should reload properties', function () {
    var store = new MemAdapter();
    var client = new Client(true);

    var dbStore = store.db({
      db: 'mydb'
    });

    var propCol = dbStore.col(DB.PROPS_COL_NAME);

    var data = {};
    data[dbStore._idName] = DB.PROPS_DOC_ID;
    var doc = propCol.doc(data);
    return doc.set({
      since: null
    }).then(function () {
      client.db({
        db: 'mydb '
      });
      return null; // prevent runaway promise warning
    });
  });

  it('should reload db', function () {

    var client = new Client(true);

    // Wait for load after next tick to ensure there is no race condition. The following code was
    // failing when the DB store loading was triggered at the adapter layer.
    return clientUtils.timeout().then(function () {
      db = client.db({
        db: 'mydb',
        store: new MemAdapter().db('mydb')
      });
      return clientUtils.once(db, 'load');
    });
  });

  it('should throw delta errors', function () {
    var client = new Client(true);
    db = client.db({
      db: 'mydb',
      store: new MemAdapter().db('mydb')
    });
    return commonUtils.shouldNonPromiseThrow(function () {
      db._onDeltaError(new Error('my err'));
    }, new Error('my err'));
  });

  it('should find and emit when no changes', function () {
    // It is very hard to reliably guarantee the following race condition using e2e testing so we
    // test here
    var emitted = false,
      client = new Client(true);

    db = client.db({
      db: 'mydb',
      store: new MemAdapter().db('mydb')
    });

    db._ready = utils.resolveFactory(); // fake

    db._localChanges = utils.resolveFactory([]); // fake

    db._emitChanges = function () {
      emitted = true;
    };

    db._findAndEmitChanges().then(function () {
      emitted.should.eql(false);
    });
  });

});
