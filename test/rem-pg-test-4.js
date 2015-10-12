var ORM = require('../scripts/orm/sql/adapters/postgres');

// TODO: incorporate into ORM tests!!

var dbPostgres = 'postgres', dbTest = 'testdb', host = 'localhost', username = 'postgres',
  password = 'secret', port = null;

var race = function () {
  var postgres = new ORM(), test1 = new ORM(), test2 = new ORM();
  return postgres.connect(dbPostgres, host, username, password, port).then(function () {
    return postgres._dropDatabase(dbTest).catch(function () {
      // OK if fails as may not exist
    });
  }).then(function () {
    return test1.connect(dbTest, host, username, password, port).catch(function (err) {
      // console.log('failed and is ok as db doesnt exist, err=', err);
    });
  }).then(function () {
    return postgres._createDatabase(dbTest);
  }).then(function () {
    return test2.connect(dbTest, host, username, password, port);
  }).then(function () {
    // console.log('test2 connect succeeded!');
  }).then(function () {
    // return test1.close(dbTest, host, username, password, port);
  }).then(function () {
// console.log('closing ', dbTest);
    return test2.close(dbTest, host, username, password, port);
  }).then(function () {
// console.log('closing ', dbPostgres);
    return postgres.close(dbPostgres, host, username, password, port);
  }).catch(function (err) {
    console.log('err=', err, 'err.stack=', err.stack);
  });
};

var race = function () {
  var orm1 = new ORM(), orm2 = new ORM();
  return orm1.connect(dbPostgres, host, username, password, port).then(function () {
    return orm2.connect(dbPostgres, host, username, password, port);
  }).then(function () {
    return orm1._query('SELECT NOW()');
  }).then(function () {
    return orm2._query('SELECT NOW()');
  }).then(function () {
    return orm1.close(dbPostgres, host, username, password, port);
  }).then(function () {
    return orm2.close(dbPostgres, host, username, password, port);
  }).catch(function (err) {
    console.log('err=', err);
  });
};

race();
