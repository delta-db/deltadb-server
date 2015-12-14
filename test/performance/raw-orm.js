'use strict';

// Benchmarking with 10,000 records:
//
// Postgres:
//  Insert: 7979ms
//  Select: 256ms
//
// MySQL: TODO

var Promise = require('bluebird');

var SQL = require('deltadb-orm-sql/scripts/adapters/postgres'),
  config = require('../../config'),
  Promise = require('bluebird');

describe('raw-orm', function () {

  this.timeout(600000000); // increase timeout

  // Change only the following to test diff # of docs
  var N = 10000; // needs to be a multiple of BATCH_SIZE for this test

  var sql = new SQL(),
    BATCH_SIZE = 1000,
    BATCHES = N / BATCH_SIZE;

  var createTable = function () {
    var schema = {
      id: {
        type: 'primary'
      },
      col_name: {
        type: 'varchar',
        length: 100,
        null: false
      },
      doc_uuid: {
        type: 'varbinary',
        length: 38
      }, // 38 = 36 + prefix, can be null if modifying role
      attr_name: {
        type: 'varchar',
        length: 100
      },
      attr_val: {
        type: 'text'
      },
      user_uuid: {
        type: 'varbinary',
        length: 36
      }, // userUUID of author
      super_uuid: {
        type: 'varbinary',
        length: 36
      }, // userUUID of super user
      created_at: {
        type: 'datetime',
        default: 'currenttimestamp',
        null: false
      },
      recorded_at: {
        type: 'datetime',
        default: 'currenttimestamp',
        null: false
      },
      updated_at: {
        type: 'datetime',
        default: 'currenttimestamp',
        null: false
      },
      seq: {
        type: 'smallint'
      }, // for back-to-back changes w/ same updatedAt
      quorum: {
        type: 'boolean'
      } // true if quorum of servers have attr recorded
    };

    return sql.createTable('queue_attrs', schema);
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
    var rec = {
      col_name: 'some-col',
      doc_uuid: 'doc-uuid',
      attr_name: 'priority',
      attr_val: '"high"',
      user_uuid: 'user-uuid',
      super_uuid: 'super-uuid',
      recorded_at: new Date(),
      updated_at: new Date(),
      seq: 0,
      quorum: true
    };

    return sql.insert(rec, 'queue_attrs', 'id');
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

  // ---

  // Note: this is a best case benchmark as reading data from DeltaDB requires joining with user and
  // role tables, etc...

  var selectBatch = function (offset) {
    var rec = [
      'col_name',
      'doc_uuid',
      'attr_name',
      'attr_val',
      'user_uuid',
      'super_uuid',
      'recorded_at',
      'updated_at',
      'seq',
      'quorum'
    ];

    return sql.find(rec, 'queue_attrs', null, null, null, BATCH_SIZE, offset);
  };

  var selectBatches = function () {
    // The client has to select the data sequentially
    var chain = Promise.resolve();

    var selectBatchFactory = function (i) {
      return selectBatch(i * BATCH_SIZE);
    };

    for (var i = 0; i < BATCHES; i++) {
      chain = selectBatchFactory(i).then();
    }
    return chain;
  };

  it('should select', function () {
    return selectBatches();
  });

});
