'use strict';

// TODO: make this test part of the standard tests and disable by default by checking for an env
// var. This way, we can test the performance in an actual browser.

// Benchmarks:

// 10,000 docs on 12/17/15
// ✓ should write and record (359006ms)
// ✓ should destroy locally
// ✓ should read quickly (2748ms)

// 1,000 docs on 12/17/15
// ✓ should write and record (28646ms)
// ✓ should destroy locally
// ✓ should read quickly (2290ms)

var DeltaDB = require('deltadb'),
  config = require('../../config'),
  Promise = require('bluebird'),
  commonUtils = require('deltadb-common-utils');

describe('e2e', function () {

  this.timeout(500000); // increase timeout

  // Change only the following to test diff # of docs
  // var N = 10000;
  var N = 1000;

  var db = null,
    tasks = null;

  var createDB = function () {
    db = new DeltaDB('mydb', config.URL);
    tasks = db.col('tasks');
  };

  before(function () {
    createDB();
  });

  after(function () {
    return db.destroy();
  });

  it('should write and record', function () {
    var promises = [];

    for (var i = 0; i < N; i++) {
      var task = tasks.doc({
        thing: 'play'
      });
      promises.push(commonUtils.once(task, 'attr:record')); // has the doc been recorded?
    }

    return Promise.all(promises);
  });

  it('should destroy locally', function () {
    // Simulate a fresh start by destroying the local DB. We do this in a separate test so as to not
    // skew the timing reported for the "should read quickly" test
    return db.destroy(true);
  });

  it('should read quickly', function () {
    return new Promise(function (resolve) {
      createDB();

      var i = 0;
      tasks.on('doc:record', function () {
        i++;
        if (i === N) { // have we read all the docs?

          // Sanity dump
          // tasks.all(function (task) {
          //   console.log('task=', task.get());
          // });

          resolve();
        }
      });
    });
  });

});
