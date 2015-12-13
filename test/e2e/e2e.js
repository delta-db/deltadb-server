'use strict';

/* global before */

var Client = require('deltadb/scripts/adapter');

describe('e2e', function () {

  before(function () {
    // Our tests will occassionally break when we change the code so we make sure that we remove
    // any test IndexedDB's so that we don't have to remove them manually in the browser.
    var client = new Client(true);

    var db1 = client.db({
      db: 'mydb'
    });

    var db2 = client.db({
      db: 'myotherdb'
    });

    return db1.destroy(true).then(function () {
      return db2.destroy(true);
    });
  });

  require('./basic');
  
  require('./auth-filter');

  require('./auth');

  require('./separate');

  require('./system');

  require('./race');

});
