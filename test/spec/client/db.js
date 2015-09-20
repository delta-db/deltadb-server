'use strict';

var DB = require('../../../scripts/client/db'),
  MemAdapter = require('../../../scripts/orm/nosql/adapters/mem');

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

});