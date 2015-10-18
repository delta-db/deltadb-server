'use strict';

var DeltaDB = require('../../../scripts/client/delta-db');

describe('delta-db', function () {

  it('should create and destroy locally only', function () {
    var db = new DeltaDB('mydb');
    return db.destroy();
  });

  it('should uuid', function () {
    var uuid = DeltaDB.uuid();
    (uuid !== null).should.eql(true);
  });

});
