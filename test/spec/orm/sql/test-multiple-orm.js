'use strict';

// TODO: better organize

var testUtils = require('../../../utils');

/**
 * Sharing one connection between multiple ticks is complicated and is tested here.
 */
var testORM = function (name, Adapter) {

  describe(name, function () {

    testUtils.setUp(this);

    var postgres = null,
      dbPostgres = 'postgres',
      dbTest = 'testdb',
      host = 'localhost',
      username = 'postgres',
      password = 'secret',
      port = null;

    beforeEach(function () {
      postgres = new Adapter();
    });

    it('should allow simulatenous queries', function () {
      var orm1 = new Adapter(),
        orm2 = new Adapter();
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
      });
    });

    it('should retry connections', function () {
      var test1 = new Adapter(),
        test2 = new Adapter();
      return postgres.connect(dbPostgres, host, username, password, port).then(function () {
        return test1.connect(dbTest, host, username, password, port).catch(function () {
          // failed and is ok as db doesnt exist
        });
      }).then(function () {
        return postgres._createDatabase(dbTest);
      }).then(function () {
        return test2.connect(dbTest, host, username, password, port);
      }).then(function () {
        // test2 connect succeeded!
      }).then(function () {
        // return test1.close(dbTest, host, username, password, port);
      }).then(function () {
        return test2.close(dbTest, host, username, password, port);
      }).then(function () {
        return postgres._dropDatabase(dbTest);
      }).then(function () {
        return postgres.close(dbPostgres, host, username, password, port);
      });
    });

    it('should destroy connections', function () {
      // Make sure that destroying a database doesn't tie up the connections
      var test1 = new Adapter(),
        test2 = new Adapter();
      return postgres.connect(dbPostgres, host, username, password, port).then(function () {
        return postgres._createDatabase(dbTest);
      }).then(function () {
        return test1.connect(dbTest, host, username, password, port);
      }).then(function () {
        // Destroy even if being used by other clients
        return postgres._dropDatabase(dbTest, true);
      }).then(function () {
        return test2.connect(dbTest, host, username, password, port);
      }).then(function () {
        return test1._query('SELECT NOW()').catch(function () {
          // Ignore error as just want to make sure nothing blocks
        });
      }).then(function () {
        return test2._query('SELECT NOW()').catch(function () {
          // Ignore error as just want to make sure nothing blocks
        });
      }).then(function () {
        return postgres.close(dbPostgres, host, username, password, port);
      });
    });

    it('should identify when db exists', function () {
      var test1 = new Adapter(),
        test2 = new Adapter();
      return postgres.connect(dbPostgres, host, username, password, port).then(function () {
        return postgres._createDatabase(dbTest);
      }).then(function () {
        return test1.connect(dbTest, host, username, password, port);
      }).then(function () {
        // Destroy even if being used by other clients
        return postgres._dropDatabase(dbTest, true);
      }).then(function () {
        return test2.dbExists(dbTest, host, username, password, port);
      }).then(function (exists) {
        exists.should.eql(false);
      }).then(function () {
        return postgres.close(dbPostgres, host, username, password, port);
      });
    });

    it('should drop and close when multiple connections', function () {
      // Make sure that destroying a database doesn't tie up the connections
      var test1 = new Adapter(),
        test2 = new Adapter();
      return postgres.connect(dbPostgres, host, username, password, port).then(function () {
        return postgres._createDatabase(dbTest);
      }).then(function () {
        return test1.connect(dbTest, host, username, password, port);
      }).then(function () {
        return test2.connect(dbTest, host, username, password, port);
      }).then(function () {
        // Destroy even if being used by other clients
        return test1.dropAndCloseDatabase(dbTest, host, username, password, port);
      }).then(function () {
        return postgres.close(dbPostgres, host, username, password, port);
      });
    });

  });

};

module.exports = testORM;
