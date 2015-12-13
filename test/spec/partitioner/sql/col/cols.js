'use strict';

/* global before, after */

var partDir = '../../../../../scripts/partitioner/sql';

var partUtils = require('../utils'),
  Cols = require(partDir + '/col/cols'),
  testUtils = require('../../../../utils');

describe('cols', function () {

  var args = partUtils.init(this, beforeEach, afterEach, false, before, after);

  var userUtils = null;
  beforeEach(function () {
    userUtils = args.userUtils;
  });

  it('should create reserved cols', function () {
    return args.db._sql.find(null, 'cols', null, ['id', '<=', Cols.ID_LAST_RESERVED], ['id',
      'asc'
    ]).then(function (results) {
      testUtils.contains([{
          id: Cols.ID_ALL,
          name: '$all'
        }, {
          id: Cols.ID_USER,
          name: '$user'
        }, {
          id: Cols.ID_ROLE_USERS_SUPER,
          name: '$ru$super'
        }, {
          id: Cols.ID_USER_ROLES_SUPER,
          name: '$ur$super'
        }
        //        { id: Cols.ID_ROLE_USERS_ADMIN, name: '$ru$admin' }
      ], results.rows);
    });
  });

});
