var pg = require('pg');

var conString = "postgres://postgres:secret@localhost/postgres";

var i = 0;

var createAndDrop = function () {

  // get a pg client from the connection pool
  pg.connect(conString, function(err, client, done) {
    console.log('connected to pgtest');

    var handleError = function(err) {

      // no error occurred, continue with the request
      if(!err) return false;

      console.log('handleError, err=', err);

      // An error occurred, remove the client from the connection pool.
      // A truthy value passed to done will remove the connection from the pool
      // instead of simply returning it to be reused.
      // In this case, if we have successfully received a client (truthy)
      // then it will be removed from the pool.
      // if(client){
      //   done(client);
      // }

    };

    // handle an error from the connection
    if(handleError(err)) return;

    var drop = function () {
      console.log('dropping pgtest');

      client.query('DROP DATABASE pgtest', function(err, result) {

        // handle an error from the query
        if(handleError(err)) return;

        client.end();
//done();

        if (i++ < 30) {
          createAndDrop();
        }

      });
    };

    var create = function () {
      console.log('creating pgtest');

      client.query('CREATE DATABASE pgtest', function(err, result) {

        // handle an error from the query
        if(handleError(err)) return;

        drop();

      });
    };

    create();

  });

};

createAndDrop();
