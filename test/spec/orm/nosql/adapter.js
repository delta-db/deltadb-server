'use strict';

var utils = require('../../../new-utils'),
  commonUtils = require('../../../common-utils'),
  oldUtils = require('../../../../scripts/utils'),
  Promise = require('bluebird');

// TODO: split into separate tests

var Adapter = function (adapter) {
  this._adapter = adapter;
};

Adapter.prototype.test = function () {

  var adapter = this._adapter; // for convenience

  describe('adapter ' + adapter.constructor.name, function () {

    var db = null,
      n = 1;

    beforeEach(function () {
      // For some unknown reason, it appears that the Chrome and Firefox will return an error if we
      // try to open a new DB with the same name as a DB that was just closed. Even if we wait for
      // the onsuccess callback after executing indexedDB.deleteDatabase(). Therefore, we will make
      // sure that DB name is unique per test.
      db = adapter.db({
        db: 'mydb' + (n++)
      });
    });

    afterEach(function () {
      return db.close().then(function () {
        return db.destroy();
      });
    });

    it('should work', function () {

      var user1 = null,
        user2 = null,
        users = null;

      return db.col('users').then(function (_users) {
        users = _users;

        user1 = users.doc({
          name: 'Jack',
          age: 24
        });

        user2 = users.doc({
          name: 'Jill',
          age: 23
        });

        return user1.save().then(function () {
          return user2.save();
        }).then(function () {
          return users.get(user1.id());
        }).then(function (userFound) {
          var doc = userFound.get();
          doc.should.eql({
            $id: user1.id(),
            name: 'Jack',
            age: 24
          });
        }).then(function () {
          user1._set('age', 25);
          var updates = user1.get(true);
          updates.should.eql({
            age: 25
          });
          return user1.save();
        }).then(function () {
          return users.get(user1.id());
        }).then(function (userFound) {
          var doc = userFound.get();
          doc.should.eql({
            $id: user1.id(),
            name: 'Jack',
            age: 25
          });
        }).then(function () {
          return utils.allShouldEql([{
            $id: user1.id(),
            name: 'Jack',
            age: 25
          }, {
            $id: user2.id(),
            name: 'Jill',
            age: 23
          }], users);
        }).then(function () {
          return utils.findShouldEql(
            [{
              $id: user2.id(),
              name: 'Jill',
              age: 23
            }, {
              $id: user1.id(),
              name: 'Jack',
              age: 25
            }],
            users, {
              where: [
                ['age', '<', 25], 'or', ['name', '=', 'Jack']
              ],
              order: ['age', 'asc']
                // offset: 0, // TODO: uncomment when working with indexeddb
                // limit: 2 // // TODO: uncomment when working with indexeddb
            }
          );
        }).then(function () {
          return user1.destroy();
        }).then(function () {
          return utils.allShouldEql([{
            $id: user2.id(),
            name: 'Jill',
            age: 23
          }], users);
        });
      });
    });

    it('should lookup collection', function () {
      var users = null;
      return db.col('users').then(function (_users) {
        users = _users;
        var user = users.doc({
          name: 'Jack',
          age: 24
        });
        return user.save();
      }).then(function () {
        return db.col('users');
      }).then(function (users2) {
        users2.should.eql(users);
      });
    });

    it('should get missing doc', function () {
      return db.col('users').then(function (users) {
        return users.get('missing');
      }).then(function (user) {
        (user === null).should.eql(true);
      });
    });

    it('should retrieve existing db', function () {
      var db2 = adapter.db({
        db: 'mydb' + (n - 1)
      });
      db2.should.eql(db);
    });

    it('should destroy collection', function () {
      return db.col('users').then(function (users) {
        return users.destroy();
      });
      // TODO: also test using same db after destroying col as in IDB need to close DB to destroy
      // col
    });

    ////////////////////////////////////////
    // IDB Specific, TODO: move to separate file

    // TODO: remove after add offset functionality to IDB
    it('should throw error when finding with offset', function () {
      return db.col('users').then(function (users) {
        commonUtils.shouldThrow(function () {
          return users.find({
            offset: 0
          }, function () {});
        }, new Error());
      });
    });

    // TODO: remove after add limit functionality to IDB
    it('should throw error when finding with limit', function () {
      return db.col('users').then(function (users) {
        commonUtils.shouldThrow(function () {
          return users.find({
            limit: 1
          }, function () {});
        }, new Error());
      });
    });

    it('should catch error when creating object store', function () {
      return new Promise(function (resolve) {
        var err = new Error('err');
        db._createObjectStoreIfMissing = oldUtils.promiseErrorFactory(err); // stub

        var os = {
          callback: function (_err) {
            _err.should.eql(err);
            resolve();
          }
        };

        db._openAndCreateObjectStoreFactory(os)();
      });
    });

// // TODO: fix!
//     it('should throw blocked error when destroying', function () {
//       return db._open().then(function () {
//         return commonUtils.shouldThrow(function () {
//           return db.destroy();
//         }, new Error());
//       });
//     });

  });

};

module.exports = Adapter;