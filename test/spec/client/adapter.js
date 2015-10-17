'use strict';

var MemAdapter = require('../../../scripts/orm/nosql/adapters/mem'),
  Client = require('../../../scripts/client/adapter'),
  Promise = require('bluebird');

describe('adapter', function () {

  var store = null,
    client = null;

  beforeEach(function () {
    store = new MemAdapter();
    client = new Client(store, true);
  });

  var fakeResolveAfterDatabaseDestroyed = function () {
    client._resolveAfterDatabaseDestroyed = function (dbName, originatingDoc) {
      // Create promise and listen for new doc before syncing
      var promise = Client.prototype._resolveAfterDatabaseDestroyed.apply(this, arguments);

      // Fake syncing
      var doc = originatingDoc._col.doc({
        $db: 'mydb'
      });
      doc._dat.destroyedAt = new Date();
      originatingDoc._col.emit('doc:destroy', doc);

      // Fake other delta
      doc = originatingDoc._col.doc();
      originatingDoc._col.emit('doc:destroy', doc);

      return promise;
    };
  };

  it('should create database', function () {

    client._resolveAfterDatabaseCreated = function (dbName, originatingDoc) {
      // Create promise and listen for new doc before syncing
      var promise = Client.prototype._resolveAfterDatabaseCreated.apply(this, arguments);

      // Fake syncing
      var doc = originatingDoc._col.doc({
        $db: 'mydb'
      });
      doc._dat.recordedAt = new Date();
      originatingDoc._col.emit('doc:create', doc);

      // Fake other delta
      doc = originatingDoc._col.doc();
      originatingDoc._col.emit('doc:create', doc);

      return promise;
    };

    return client._createDatabase('mydb');

  });

  it('should destroy database', function () {

    fakeResolveAfterDatabaseDestroyed();

    return client._destroyDatabase('mydb', true);

  });

  it('should disconnect when destroying', function () {
    fakeResolveAfterDatabaseDestroyed();

    var db = client.db({
      db: 'mydb'
    });

    var disconnected = false;
    db._disconnect = function () { // spy
      disconnected = true;
      return Promise.resolve();
    };

    return client._destroyDatabase('mydb', false).then(function () {
      disconnected.should.eql(true);
    });
  });

  it('should only create system db once', function () {
    var sysDB1 = client._systemDB(),
      sysDB2 = client._systemDB();
    sysDB2.should.eql(sysDB1);
  });

});