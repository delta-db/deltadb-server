'use strict';

var Client = require('../../../scripts/client/adapter'),
  Promise = require('bluebird'),
  MemAdapter = require('../../../scripts/orm/nosql/adapters/mem');

describe('adapter', function () {

  var client = null;

  beforeEach(function () {
    client = new Client(true);
  });

  var fakeResolveAfterDatabaseCreated = function () {
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
  };

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

  it('should create & destroy database', function () {

    fakeResolveAfterDatabaseCreated();
    fakeResolveAfterDatabaseDestroyed();

    return client._createDatabase('mydb').then(function () {
      return client._destroyDatabase('mydb', true);
    });

  });

  it('should disconnect when destroying', function () {

    fakeResolveAfterDatabaseCreated();
    fakeResolveAfterDatabaseDestroyed();

    var db = client.db({
      db: 'mydb',
      store: new MemAdapter().db('mydb')
    });

    var disconnected = false;
    db._disconnect = function () { // spy
      disconnected = true;
      return Promise.resolve();
    };

    return client._createDatabase('mydb').then(function () {
      return client._destroyDatabase('mydb', false);
    }).then(function () {
      disconnected.should.eql(true);
    });
  });

  it('should only create system db once', function () {
    var sysDB1 = client._systemDB(),
      sysDB2 = client._systemDB();
    sysDB2.should.eql(sysDB1);
  });

});
