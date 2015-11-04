'use strict';

/* global before, after */

var partUtils = require('../utils'),
  constants = require('../../../../../scripts/partitioner/sql/constants'),
  ProcTestUtils = require('./utils');

describe('boolean', function () {

  var args = partUtils.init(this, beforeEach, afterEach, null, before, after);
  var utils = args.utils;
  var procTestUtils = null;

  beforeEach(function () {
    procTestUtils = new ProcTestUtils(args.db);
  });

  var createChanges = [{
    col: 'task',
    id: '1',
    name: 'completed',
    val: 'false',
    up: '2014-01-01T10:00:00.000Z'
  }];

  var create = function () {

    var attrs = function (partition) {
      return utils.attrsShouldEql(args.db, partition, [{
        name: 'completed',
        value: 'false',
        updated_at: createChanges[0].up
      }], true);
    };

    var allAttrs = function () {
      return attrs(constants.ALL).then(function () {
        return attrs(constants.RECENT);
      }).then(function () {
        return attrs(constants.LATEST);
      });
    };

    return procTestUtils.queueAndProcess(createChanges).then(function () {
      return procTestUtils.allDocs(null, createChanges[0].up);
    }).then(function () {
      return allAttrs();
    });
  };

  var updateChanges = [{
    col: 'task',
    id: '1',
    name: 'completed',
    val: 'false',
    up: '2014-01-01T10:00:00.100Z'
  }];

  var update = function () {

    var allOrRecentAttrs = function (partition) {
      return utils.attrsShouldEql(args.db, partition, [{
        name: 'completed',
        value: 'false',
        updated_at: createChanges[0].up
      }, {
        name: 'completed',
        value: 'false',
        updated_at: updateChanges[0].up
      }], true);
    };

    var latestAttrs = function () {
      return utils.attrsShouldEql(args.db, constants.LATEST, [{
        name: 'completed',
        value: 'false',
        updated_at: updateChanges[0].up
      }], true);
    };

    var allAttrs = function () {
      return allOrRecentAttrs(constants.ALL).then(function () {
        return allOrRecentAttrs(constants.RECENT);
      }).then(function () {
        return latestAttrs();
      });
    };

    return procTestUtils.queueAndProcess(updateChanges).then(function () {
      return procTestUtils.allDocs(null, updateChanges[0].up);
    }).then(function () {
      return allAttrs();
    });
  };

  var destroyAttrChanges = [{
    col: 'task',
    id: '1',
    name: 'completed',
    up: '2014-01-01T10:02:00.000Z'
  }];

  var destroyAttr = function () {

    var allOrRecentAttrs = function (partition) {
      return utils.attrsShouldEql(args.db, partition, [{
        name: 'completed',
        value: 'false',
        updated_at: createChanges[0].up
      }, {
        name: 'completed',
        value: 'false',
        updated_at: updateChanges[0].up
      }, {
        name: 'completed',
        updated_at: destroyAttrChanges[0].up
      }], true);
    };

    var recentOrLatestAttrs = function (partition) {
      return utils.attrsShouldEql(args.db, partition, [{
        name: 'completed',
        updated_at: destroyAttrChanges[0].up
      }], true);
    };

    var allAttrs = function () {
      return allOrRecentAttrs(constants.ALL).then(function () {
        return allOrRecentAttrs(constants.RECENT);
      }).then(function () {
        return recentOrLatestAttrs(constants.LATEST);
      });
    };

    return procTestUtils.queueAndProcess(destroyAttrChanges).then(function () {
      return procTestUtils.allDocs(null, destroyAttrChanges[0].up);
    }).then(function () {
      return allAttrs();
    });
  };

  it('should create', function () {
    return create();
  });

  it('should update', function () {
    return create().then(function () {
      return update();
    });
  });

  it('should delete', function () {
    return create().then(function () {
      return update();
    }).then(function () {
      return destroyAttr();
    });
  });

});
