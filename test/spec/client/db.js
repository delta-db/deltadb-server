'use strict';

var DB = require('../../../scripts/client/db'),
  MemAdapter = require('../../../scripts/orm/nosql/adapters/mem'),
  Client = require('../../../scripts/client/adapter'),
  utils = require('../../../scripts/utils'),
  clientUtils = require('../../../scripts/client/utils');

describe('db', function () {

  it('should reload properties', function () {
    var dbStore = (new MemAdapter()).db({
      db: 'mydb'
    });

    var propCol = dbStore.col(DB.PROPS_COL_NAME);

    var data = {};
    data[dbStore._idName] = DB.PROPS_DOC_ID;
    var doc = propCol.doc(data);
    return doc.set({
      since: null
    }).then(function () {
      new DB(null, null, dbStore);
    });
  });

  it('should reload db', function () {

    var store = new MemAdapter();
    var client = new Client(store);

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