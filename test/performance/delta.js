'use strict';

/* global before, after */

// INSERTING BASELINE (10,000 RECORDS)
// Note: DeltaDB will never be faster than this as this this is the min time it takes to just insert
//       the data.
// - MySQL & PHP: 1 sec!!
// - Postgres & PHP: 5.5 secs
// - MySQL & Node: 2 secs
// - Postgres & Node: 5.3 secs

// 2/19/2015:
// (10,000 docs)
// ✓ should write quickly (35842ms)
// ✓ should process quickly (165928ms)
// ✓ should read quickly (353ms)

// (100,000 docs) - appears to scale linearly, which is good
// ✓ should write quickly (366204ms)
// ✓ should process quickly (1624954ms) - this can probably be improved with optimizations
// ✓ should read quickly (268ms)


// 5/17/2015:
// (10,000 docs)
// ✓ should write quickly (8379ms)
// ✓ should process quickly (258023ms)
// ✓ should read quickly (1481ms)

// (100,000 docs) - appears to scale linearly, which is good
// ✓ should write quickly (93438ms)
// ✓ should process quickly (??) - this can probably be improved with optimizations
// ✓ should read quickly (??)


// TODO: Isn't this slow? If doc has say 10 attrs then this is only really 1,000 docs. Could this be
// sped up by:
// 1. Group changes together for the same doc?
// 2. Dumping queued attributes to files and not storing in a DB table?
// 3. Caching groups of read changes every X mins for attributes that aren't time sensitive?

// 6/3/2015:
// (10,000 docs)
// ✓ should write quickly (8996ms)
// ✓ should process quickly (265569ms)
// ✓ should read quickly (12281ms)

// 6/8/2015 (after nested query for changes):
// (10,000 docs)
// ✓ should write quickly (13171ms)
// ✓ should process quickly (230944ms)
// ✓ should read quickly (1077ms) <---- MUCH FASTER!!

var Promise = require('bluebird');

var DB = require('../../scripts/partitioner/sql');

describe('delta', function () {

  this.timeout(600000000); // increase timeout

  // Change only the following to test diff # of docs
  var N = 10000; // needs to be a multiple of BATCH_SIZE for this test

  // If the data has already been written and processed then you can set these to just test the
  // reading portion. You have to run in this order:
  // 1. JUST_READ=false, DESTROY_DB=false
  // 2. JUST_READ=true, DESTROY_DB=false (you can then run this any number of times in a row)
  var JUST_READ = false;
  var DESTROY_DB = true;

  var db = null,
    since = null,
    n = 0,
    BATCH_SIZE = 1000,
    BATCHES = N / BATCH_SIZE;

  before(function () {
    db = new DB('a');
    return JUST_READ ? db.connect() : db.createDatabase();
  });

  after(function () {
    if (DESTROY_DB) {
      return db.destroyDatabase();
    }
  });

  var queueNextBatch = function () {
    var changes = [],
      t = (new Date()).getTime();
    for (var j = 0; j < BATCH_SIZE; j++) {
      var id = n++;
      changes.push({
        col: 'task',
        id: id,
        name: 'foo',
        val: '"' + (new Date()) + '"',
        up: new Date(t + id)
      });
    }
    return db.queue(changes, true);
  };

  if (!JUST_READ) {
    it('should write quickly', function () {
      // Note: substantially faster to sequentially chain queue batches than to use Promise.all()
      var chain = Promise.resolve();
      var queueNextBatchFactory = function () {
        return queueNextBatch();
      };
      for (var j = 0; j < BATCHES; j++) {
        chain = chain.then(queueNextBatchFactory);
      }
      return chain;
    });

    it('should process quickly', function () {
      // Need to process promises sequentially so that each call to process returns the next batch
      var chain = Promise.resolve();
      var processFactory = function () {
        return db.process();
      };
      for (var j = 0; j < BATCHES; j++) {
        chain = chain.then(processFactory);
      }
      return chain;
    });
  }

  it('should read quickly', function () {
    // Process sequentially to simulate normal reading by pages
    var chain = Promise.resolve(),
      limit = BATCH_SIZE,
      offset = 0;

    var changesFactory = function () {
      return db.changes(since, false, limit, offset).then(function () {
        offset += limit;
      });
    };

    for (var j = 0; j < BATCHES; j++) {
      chain = chain.then(changesFactory);
    }
    return chain.then(function () {
      offset.should.eql(N);
    });
  });

});