'use strict';

var idbUtils = require('../../scripts/orm/nosql/adapters/indexeddb/utils'),
  IDBAdapter = require('../../scripts/orm/nosql/adapters/indexeddb');

describe('e2e', function () {

  before(function () {
    if (global.window && idbUtils.indexedDB()) { // using IndexedDB?
      // Our tests will occassionally break when we change the code so we make sure that we remove
      // any test IndexedDB's so that we don't have to remove them manually in the browser.
      var idb = new IDBAdapter();
      var system = idb.db({
        db: '$system'
      });
      var mydb = idb.db({
        db: 'mydb'
      });
      return system.destroy().then(function () {
        return mydb.destroy();
      });
    };
  });

  require('./basic');

  require('./separate');

  require('./race');

});
