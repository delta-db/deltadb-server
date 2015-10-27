'use strict';

var DeltaDB = require('../../scripts/client/delta-db'),
  config = require('../../config'),
  DB = require('../../scripts/client/db'),
  Promise = require('bluebird');

describe('basic', function () {

  var a = null,
    aTasks = null;

  beforeEach(function () {
    a = new DeltaDB('mydb', config.URL);
    aTasks = a.col('tasks');
  });

  afterEach(function () {
    return a.destroy().then(function () {
      return DeltaDB._systemDB().destroy(true, false);
    });
  });

  it('should send and receive changes', function () {

    var numSends = 0,
      numReceives = 0;

    var task1 = aTasks.doc({
      thing: 'write'
    });

    // Create spy to verify that changes sent only once
    a._emitChanges = function (changes) {
      numSends++;
      changes.should.eql([{
        up: changes[0].up,
        id: changes[0].id,
        name: 'thing',
        val: '"write"',
        col: 'tasks'
      }]);
      return DB.prototype._emitChanges.apply(this, arguments);
    };

    // Create spy to verify that changes received only once
    a._setChanges = function (changes) {
      numReceives++;
      changes.should.eql([{
        up: changes[0].up,
        id: changes[0].id,
        re: changes[0].re,
        name: 'thing',
        val: '"write"',
        col: 'tasks'
      }]);
      return DB.prototype._setChanges.apply(this, arguments);
    };

    return new Promise(function (resolve) {
      var err = true;

      task1.on('attr:record', function (attr) {
        if (attr.name === 'thing') { // receiving priority from server?

          if (numSends !== 1) {
            throw new Error('sent more than once');
          }

          if (numReceives !== 1) {
            throw new Error('received more than once');
          }

          err = false;
          resolve();
        }
      });

      task1.save();
    });

  });

  // TODO: (diff file) use two instances of DeltaDB to test in same app

  // TODO: test changes made to client after it has already done the initial sync, i.e. client needs
  // to trigger sync. How to determine when initial sync done? Can do this with spy?

  // TODO: test changes made to server after it has already done the initial sync, i.e. server needs
  // to trigger sync. How to determine when initial sync done? Can do this with spy?

  // TODO: test connect/disconnect and making changes when disconnected

  // TODO: test send interval by making interval large and making a bunch of changes in a short
  // period of time and making sure sync only called twice

  // TODO: test local only mode

});
