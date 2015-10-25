'use strict';

var utils = require('../../../new-utils');

// TODO: split into separate tests

var Adapter = function (AdapterClass) {
  this._Adapter = AdapterClass;
  this._adapter = new AdapterClass();
};

Adapter.prototype.test = function () {

  var adapter = this._adapter; // for convenience

  // TODO: fix adapter name here. Is there a way to make this automatic or do we need to pass the
  // name into the test
  describe('adapter ' + adapter.constructor.name, function () {

    var db = null;

    beforeEach(function () {
      db = adapter.db({
        db: 'mydb'
      });
    });

    afterEach(function () {
      return db.destroy();
    });

    it('should work', function () {

      var users = db.col('users');

      var user1 = users.doc({
        name: 'Jack',
        age: 24
      });

      var user2 = users.doc({
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

    it('should lookup collection', function () {
      var users = db.col('users');

      var user = users.doc({
        name: 'Jack',
        age: 24
      });

      return user.save().then(function () {
        return db.col('users');
      }).then(function (users2) {
        users2.should.eql(users);
      });
    });

    it('should get missing doc', function () {
      var users = db.col('users');
      return users.get('missing').then(function (user) {
        (user === null).should.eql(true);
      });
    });

    it('should retrieve existing db', function () {
      var db2 = adapter.db({
        db: 'mydb'
      });
      db2.should.eql(db);
    });

    it('should destroy collection', function () {
      var users = db.col('users');
      return users.destroy();
      // TODO: also test using same db after destroying col as in IDB need to close DB to destroy
      // col
    });

    it('should unset', function () {
      var users = db.col('users');

      var user = users.doc({
        name: 'Jack',
        age: 24
      });

      return user.save().then(function () {
        return user.unset('age');
      }).then(function () {
        user.get().should.eql({
          $id: user.id(),
          name: 'Jack'
        });
      });
    });

    it('should include', function () {
      // TODO: this test is only for coverage, make it more meaningful
      var users = db.col('users');
      var user = users.doc();
      (user._include() !== null).should.eql(true);
    });

    it('should register when missing', function () {
      // TODO: this test is only for coverage, make it more meaningful
      var users = db.col('users');

      var user = users.doc({
        $id: 1
      });

      return user._register();
    });

  });

};

module.exports = Adapter;
