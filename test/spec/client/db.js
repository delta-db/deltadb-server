'use strict';

var DB = require('../../../scripts/client/db');

describe('db', function () {
  it('should local changes', function () {
    var db = new DB();

    db._collections = {
      0: {
        _items: {
          0: {
            _changes: {
              0: {
                sent: new Date(Date.now() + 1000)
              }
            }
          }
        }
      }
    };

    return db._localChanges();
  });
});