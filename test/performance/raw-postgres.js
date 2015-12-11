'use strict';

// !!!!!!!!!!!!!!!!!
// mysql.php takes 1 sec for 10,000 records and 10 secs for 100,000 records!! WHY IS THIS SO FAST?
// IS IT MySQL vs Postgres? PHP DB driver vs JS DB driver?

// raw-postgres take 5326ms to insert 10,000 records. Why so slow??



var Promise = require('bluebird');

var SQL = require('../../scripts/orm/sql/adapters/postgres'),
  config = require('../../config'),
  Promise = require('bluebird');

describe('raw-postgres', function () {

  this.timeout(600000000); // increase timeout

  // Change only the following to test diff # of docs
  var N = 10000; // needs to be a multiple of BATCH_SIZE for this test

  var sql = new SQL(),
    BATCH_SIZE = 1000,
    BATCHES = N / BATCH_SIZE;

  var createTable = function () {
    return sql._query([
      "CREATE TABLE IF NOT EXISTS queue_attrs(",
      "id SERIAL PRIMARY KEY,",
      "col_name VARCHAR(100) NOT NULL,",
      "doc_uuid VARCHAR(38), attr_name VARCHAR(100),",
      "attr_val TEXT,",
      "user_uuid VARCHAR(36),",
      "super_uuid VARCHAR(36),",
      "created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,",
      "recorded_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,",
      "updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,",
      "seq SMALLINT,",
      "quorum BOOLEAN",
      ")"
    ].join(''));
  };

  before(function () {
    return sql.createAndUse('testdb_raw', config.POSTGRES_HOST, config.POSTGRES_USER,
      config.POSTGRES_PWD).then(
      function () {
        return createTable();
      });
  });

  after(function () {
    return sql.dropAndCloseDatabase('testdb_raw', config.POSTGRES_HOST, config.POSTGRES_USER,
      config.POSTGRES_PWD);
  });

  var insert = function () {
    return sql._query([
      "INSERT INTO queue_attrs (",
      "col_name,",
      "doc_uuid,",
      "attr_name,",
      "attr_val,",
      "user_uuid,",
      "super_uuid,",
      "recorded_at,",
      "updated_at,",
      "seq,quorum",
      ") VALUES (",
      "'some-col',",
      "'doc-uuid',",
      "'priority',",
      "'high',",
      "'user-uuid',",
      "'super-uuid',",
      "'NOW()',",
      "'NOW()',",
      "0,",
      "true",
      ")"
    ].join(''));
  };

  var insertBatch = function () {
    var promises = [];
    for (var i = 0; i < BATCH_SIZE; i++) {
      promises.push(insert());
    }
    return Promise.all(promises);
  };

  var insertBatches = function () {
    var promises = [];
    for (var i = 0; i < BATCHES; i++) {
      promises.push(insertBatch());
    }
    return Promise.all(promises);
  };

  it('should insert', function () {
    return insertBatches();
  });

});
