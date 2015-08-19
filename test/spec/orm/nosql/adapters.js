'use strict';

// TODO: split into separate tests

// TODO: test all adapters with same code. May need to test indexeddb separately as can only be
// tested in browser

var ORM = require('../../../../scripts/orm/nosql/adapters/mem'),
  orm = new ORM();

describe('adapters', function () {

  it('should work', function () {
    return orm.connect({
      db: 'mydb'
    }).then(function (db) {
      return db.use('users').then(function (users) {
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
          return users.all();
        }).then(function (allUsers) {
          var foundUsers = [];
          return allUsers.each(function (aUser) {
            foundUsers.push(aUser.get());
          }).then(function () {
            foundUsers.should.eql([{
              $id: user1.id(),
              name: 'Jack',
              age: 25
            }, {
              $id: user2.id(),
              name: 'Jill',
              age: 23
            }]);
          });
        }).then(function () {
          return users.find({
            where: [
              ['age', '<', 25], 'or', ['name', '=', 'Jack']
            ],
            order: ['age', 'asc'],
            offset: 0,
            limit: 2
          });
        }).then(function (allUsers) {
          var foundUsers = [];
          return allUsers.each(function (aUser) {
            foundUsers.push(aUser.get());
          }).then(function () {
            foundUsers.should.eql([{
              $id: user2.id(),
              name: 'Jill',
              age: 23
            }, {
              $id: user1.id(),
              name: 'Jack',
              age: 25
            }]);
          });
        }).then(function () {
          return user1.destroy();
        }).then(function () {
          return users.all();
        }).then(function (allUsers) {
          var foundUsers = [];
          return allUsers.each(function (aUser) {
            foundUsers.push(aUser.get());
          }).then(function () {
            foundUsers.should.eql([{
              $id: user2.id(),
              name: 'Jill',
              age: 23
            }]);
          });
        }).then(function () {
          return db.close();
        });
      });
    });
  });

});