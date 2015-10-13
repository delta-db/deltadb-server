'use strict';

var DB = require('../../../scripts/client/db'),
  MemAdapter = require('../../../scripts/orm/nosql/adapters/mem'),
  Client = require('../../../scripts/client/adapter'),
  clientUtils = require('../../../scripts/client/utils');

describe('db', function () {

  it('should reload properties', function () {
    var store = new MemAdapter();
    var client = new Client(store, true);

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
      client.db({ db: 'mydb '});
    });
  });

  it('should reload db', function () {

    var store = new MemAdapter();
    var client = new Client(store, true);

    // Wait for load after next tick to ensure there is no race condition. The following code was
    // failing when the DB store loading was triggered at the adapter layer.
    return clientUtils.timeout().then(function () {
      var db = client.db({
        db: 'mydb'
      });
      return clientUtils.once(db, 'load');
    });
  });

});
