'use strict';

var DeltaDB = require('../../../scripts/client/delta-db');

describe('delta-db', function () {

  it('should instantiate', function () {
    var db = new DeltaDB('mydb');
    db.on('db:create', function () {
      // db created
    });
    db._dbName.should.eql('mydb');
  });

  it('should uuid', function () {
    var uuid = DeltaDB.uuid();
    (uuid !== null).should.eql(true);
  });

});