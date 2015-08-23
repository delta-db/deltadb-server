'use strict';

var DB = require('../../../scripts/client/db'),
  MemAdapter = require('../../../scripts/orm/nosql/adapters/mem');

describe('db', function () {

  it('should local changes', function () {
    var dbStore = (new MemAdapter()).db({ db: 'mydb' });
    var db = new DB(null, null, dbStore);

    db._collections = {
      0: {
        _docs: {
          0: {
            _changes: {
              0: {
                sent: new Date(Date.now() + 1000)
              }
            }
          }
        }
      }
    };

    return db._localChanges();
  });

  it('should reload properties', function () {
    var dbStore = (new MemAdapter()).db({ db: 'mydb' });
    return dbStore.col(DB.PROPS_COL_NAME).then(function (propCol) {
      var data = {};
      data[dbStore._idName] = DB.PROPS_DOC_ID;
      var doc = propCol.doc(data);
      return doc.set({ since: null });
    }).then(function () {
      new DB(null, null, dbStore);
    });
  });

});