'use strict';

// !!!!!!!!!!!!!!!!!
// mysql.php takes 1 sec for 10,000 records and 10 secs for 100,000 records!! WHY IS THIS SO FAST?
// IS IT MySQL vs Postgres? PHP DB driver vs JS DB driver?

// raw-mysql take 2044ms to insert 10,000 records. Faster than postgres, but why not 1 sec like PHP?
// JS or the DB driver?

// TODO: how fast would a stored procedure be? Probably couldn't beat even a C program talking
// directly to MySQL

var Promise = require('bluebird');

var SQL = require('deltadb-orm-sql/scripts/adapters/mysql'),
  config = require('../../config'),
  Promise = require('bluebird');

describe('raw-mysql', function () {

  this.timeout(600000000); // increase timeout

  // Change only the following to test diff # of docs
  var N = 10000; // needs to be a multiple of BATCH_SIZE for this test

  var sql = new SQL(),
    BATCH_SIZE = 1000,
    BATCHES = N / BATCH_SIZE;

  var createTable = function () {
    return sql._query([
      'CREATE TABLE `queue_attrs` (',
      '`id` int(11) unsigned NOT NULL AUTO_INCREMENT,',
      '`col_name` varchar(100) NOT NULL,',
      '`doc_uuid` varbinary(38) NOT NULL,',
      '`attr_name` varchar(100) NOT NULL,',
      '`attr_val` text NOT NULL,',
      '`user_uuid` varbinary(36) NOT NULL,',
      '`super_uuid` varbinary(36) NOT NULL,',
      '`created_at` datetime NOT NULL,',
      '`recorded_at` datetime NOT NULL,',
      '`updated_at` datetime NOT NULL,',
      '`seq` smallint(6) NOT NULL,',
      '`quorum` tinyint(1) NOT NULL,',
      'PRIMARY KEY (`id`)',
      ') ENGINE=MyISAM DEFAULT CHARSET=utf8;'
    ].join(''));
  };

  before(function () {
    return sql.createAndUse('testdb_raw', config.POSTGRES_HOST, config.POSTGRES_USER,
      config.POSTGRES_PWD).then(function () {
      return createTable();
    });
  });

  after(function () {
    return sql._query('DROP DATABASE testdb_raw');
  });

  var insert = function () {
    return sql._query([
      "INSERT INTO `deltadb`.`queue_attrs` (`id`, `col_name`, `doc_uuid`, `attr_name`, `attr_val`,",
      "`user_uuid`, `super_uuid`, `created_at`, `recorded_at`, `updated_at`, `seq`, `quorum`)",
      "VALUES (NULL, 'some-col', 'doc-uuid', 'priority', 'high', 'user-uuid', 'super-uuid', NOW(),",
      "NOW(), NOW(), '0', '1')"
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
