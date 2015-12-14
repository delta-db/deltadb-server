'use strict';

var partDir = '../../../../../scripts/partitioner/sql';

var partUtils = require('../utils'),
  ColRoles = require(partDir + '/col/col-roles'),
  constants = require(partDir + '/constants'),
  testUtils = require('../../../../utils');

describe('col-roles', function () {

  var args = partUtils.init(this, beforeEach, afterEach, false, before, after);

  var userUtils = null,
    colRoles = null;

  beforeEach(function () {
    userUtils = args.userUtils;
    colRoles = new ColRoles(args.db._sql);
    return args.db._sql.truncateTable(ColRoles.NAME);
  });

  it('should replace col-roles', function () {
    var roleIds = {
        'role1': 1,
        'role2': 2
      },
      updatedAt = new Date();
    var roleActions1 = [{
      role: 'role1',
      action: 'create',
      name: null
    }];
    return colRoles.setColRoles(roleIds, 1, roleActions1, updatedAt).then(function () {
      var colRoles1 = [{
        col_id: 1,
        name: null,
        role_id: 1,
        action: 'create'
      }];
      return testUtils.colRolesShouldEql(args.db, colRoles1, null);
    }).then(function () {
      var roleActions2 = [{
        role: 'role1',
        action: 'destroy',
        name: null
      }];
      return colRoles.setColRoles(roleIds, 1, roleActions2, updatedAt);
    }).then(function () {
      var colRoles2 = [{
        col_id: 1,
        name: null,
        role_id: 1,
        action: 'destroy'
      }];
      return testUtils.colRolesShouldEql(args.db, colRoles2, null);
    });
  });

  it('should preserve existing col-roles', function () {
    var roleIds = {
        'role1': 1,
        'role2': 2
      },
      updatedAt = new Date();

    var roleActions1 = [{
      role: 'role1',
      action: 'create',
      name: null
    }];

    var colRoles1 = [{
      col_id: 1,
      name: null,
      role_id: 1,
      action: 'create'
    }];

    return colRoles.setColRoles(roleIds, 1, roleActions1, updatedAt).then(function () {
      // TODO: do a find and get entire table contents, including timestamps and then check below
      return testUtils.colRolesShouldEql(args.db, colRoles1, null);
    }).then(function () {
      return colRoles.setColRoles(roleIds, 1, roleActions1, updatedAt);
    }).then(function () {
      return testUtils.colRolesShouldEql(args.db, colRoles1, null);
    });
  });

  it('should replace col & attr col-roles', function () {
    var roleIds = {
        'role1': 1,
        'role2': 2
      },
      updatedAt = new Date();
    var roleActions1 = [{
      role: 'role1',
      action: 'create',
      name: null
    }, {
      role: 'role2',
      action: 'update',
      name: null
    }, {
      role: 'role2',
      action: 'update',
      name: 'attr1'
    }];

    return colRoles.setColRoles(roleIds, 1, roleActions1, updatedAt).then(function () {
      var colRoles1 = [{
        col_id: 1,
        name: 'attr1',
        role_id: 2,
        action: 'update'
      }, {
        col_id: 1,
        name: null,
        role_id: 1,
        action: 'create'
      }, {
        col_id: 1,
        name: null,
        role_id: 2,
        action: 'update'
      }];
      return testUtils.colRolesShouldEql(args.db, colRoles1, null);
    }).then(function () {
      var roleActions2 = [{
        role: 'role1',
        action: 'update',
        name: 'attr1'
      }, {
        role: 'role2',
        action: 'create',
        name: null
      }, {
        role: 'role1',
        action: 'destroy',
        name: null
      }];
      return colRoles.setColRoles(roleIds, 1, roleActions2, updatedAt);
    }).then(function () {
      var colRoles2 = [{
        col_id: 1,
        name: 'attr1',
        role_id: 1,
        action: 'update'
      }, {
        col_id: 1,
        name: null,
        role_id: 2,
        action: 'create'
      }, {
        col_id: 1,
        name: null,
        role_id: 1,
        action: 'destroy'
      }];
      return testUtils.colRolesShouldEql(args.db, colRoles2, null);
    });
  });

  it('should have non-attr policy', function () {
    return colRoles.hasPolicy(1).then(function (has) {
      has.should.eql(false);
    }).then(function () {
      return colRoles.create(1, null, 1, constants.ACTION_CREATE, new Date());
    }).then(function () {
      return colRoles.hasPolicy(1);
    }).then(function (has) {
      has.should.eql(true);
    });
  });

  it('should have attr policy', function () {
    return colRoles.hasPolicy(1).then(function (has) {
      has.should.eql(false);
    }).then(function () {
      return colRoles.create(1, null, 1, constants.ACTION_CREATE, new Date());
    }).then(function () {
      return colRoles.hasPolicy(1, 'someattr');
    }).then(function (has) {
      has.should.eql(false);
    }).then(function () {
      return colRoles.create(1, 'someattr', 1, constants.ACTION_CREATE, new Date());
    }).then(function () {
      return colRoles.hasPolicy(1, 'someattr');
    }).then(function (has) {
      has.should.eql(true);
    });
  });

});
