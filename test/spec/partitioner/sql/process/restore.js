'use strict';

/* global before, after */

var partUtils = require('../utils'),
  constants = require('../../../../../scripts/partitioner/sql/constants'),
  testUtils = require('../../../../utils');

describe('restore', function () {

  var args = partUtils.init(this, beforeEach, afterEach, null, before, after);

  var queueAndProcess = function (changes) {
    // Force quorum=true. We will test the processing of quorum elsewhere
    return testUtils.queueAndProcess(args.db, changes, true);
  };

  var docs = function (partition, destroyedAt, updatedAt, lastDestroyedAt) {
    destroyedAt = (destroyedAt ? new Date(destroyedAt) : null);
    lastDestroyedAt = (lastDestroyedAt ? new Date(lastDestroyedAt) : destroyedAt);
    return testUtils.docsShouldEql(args.db, partition, [{
      uuid: '1',
      updated_at: updatedAt,
      destroyed_at: destroyedAt,
      last_destroyed_at: lastDestroyedAt
    }]);
  };

  var allDocs = function (destroyedAt, updatedAt, lastDestroyedAt) {
    return docs(constants.ALL, destroyedAt, updatedAt, lastDestroyedAt).then(function () {
      return docs(constants.RECENT, destroyedAt, updatedAt, lastDestroyedAt);
    }).then(function () {
      return docs(constants.LATEST, destroyedAt, updatedAt, lastDestroyedAt);
    });
  };

  var createChanges = [{
      col: 'task',
      id: '1',
      name: 'thing',
      val: '"sing a song"',
      up: '2014-01-01T10:01:00.000Z'
    }, {
      col: 'task',
      id: '1',
      name: 'priority',
      val: '"medium"',
      up: '2014-01-01T10:01:00.000Z'
    }],

    deleteChanges = [{
      col: 'task',
      id: '1',
      up: '2014-01-01T10:02:00.000Z'
    }]; // del doc

  // should restore doc, including priority
  var restoreChanges = [{
    col: 'task',
    id: '1',
    name: 'thing',
    val: '"sing a ballad"',
    up: '2014-01-01T10:03:00.000Z'
  }];

  var create = function () {

    var attrs = function (partition) {
      return testUtils.attrsShouldEql(args.db, partition, [{
        name: 'priority',
        value: '"medium"',
        updated_at: createChanges[1].up
      }, {
        name: 'thing',
        value: '"sing a song"',
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

    return queueAndProcess(createChanges).then(function () {
      return allDocs(null, createChanges[1].up);
    }).then(function () {
      return allAttrs();
    });
  };

  var destroy = function () {

    var attrs = function (partition) {
      return testUtils.attrsShouldEql(args.db, partition, [{
        name: 'priority',
        value: '"medium"',
        updated_at: createChanges[1].up
      }, {
        name: 'thing',
        value: '"sing a song"',
        updated_at: createChanges[0].up
      }, {
        name: null,
        value: null,
        updated_at: deleteChanges[0].up
      }], true);
    };

    var allAttrs = function () {
      return attrs(constants.ALL).then(function () {
        return attrs(constants.RECENT);
      }).then(function () {
        return attrs(constants.LATEST);
      });
    };

    return queueAndProcess(deleteChanges).then(function () {
      // destroyed_at set at doc level so that querying of all undestroyed docs is faster
      return allDocs(deleteChanges[0].up, createChanges[1].up);
    }).then(function () {
      return allAttrs();
    });
  };

  var restore = function () {

    var allOrRecentAttrs = function (partition) {
      return testUtils.attrsShouldEql(args.db, partition, [{
        name: 'priority',
        value: '"medium"',
        updated_at: createChanges[1].up
      }, {
        name: 'priority',
        value: '"medium"',
        updated_at: restoreChanges[0].up,
        seq: -1
      }, {
        name: 'thing',
        value: '"sing a song"',
        updated_at: createChanges[0].up
      }, {
        name: 'thing',
        value: '"sing a ballad"',
        updated_at: restoreChanges[0].up,
        seq: -1
      }, {
        name: 'thing',
        value: '"sing a ballad"',
        updated_at: restoreChanges[0].up
      }, {
        name: null,
        value: null,
        updated_at: deleteChanges[0].up
      }], true);
    };

    var recentOrLatestAttrs = function (partition) {
      return testUtils.attrsShouldEql(args.db, partition, [{
        name: 'priority',
        value: '"medium"',
        updated_at: restoreChanges[0].up,
        seq: -1
      }, {
        name: 'thing',
        value: '"sing a ballad"',
        updated_at: restoreChanges[0].up
      }, {
        name: null,
        value: null,
        updated_at: deleteChanges[0].up
      }], true);
    };

    var allAttrs = function () {
      return allOrRecentAttrs(constants.ALL).then(function () {
        return allOrRecentAttrs(constants.RECENT);
      }).then(function () {
        return recentOrLatestAttrs(constants.LATEST);
      });
    };

    return queueAndProcess(restoreChanges).then(function () {
      return allDocs(null, restoreChanges[0].up, deleteChanges[0].up);
    }).then(function () {
      return allAttrs();
    });
  };

  it('should auto restore', function () {
    return create().then(function () {
      return destroy();
    }).then(function () {
      return restore();
    });
  });

  it('should not auto restore when all changes occur at the same time', function () {

    // Although unlikely, all of the following changes could be from the same client--this is more a
    // test of DB consistency. Priority is given to deletions and therefore, the latest change will
    // NOT trigger an auto restore.

    var createChanges = [{
      col: 'task',
      id: '1',
      name: 'priority',
      val: '"medium"',
      up: '2014-01-01T10:00:00.000Z'
    }];

    var deleteChanges = [{
      col: 'task',
      id: '1',
      up: '2014-01-01T10:00:00.000Z'
    }]; // del doc

    var restoreChanges = [{
      col: 'task',
      id: '1',
      name: 'priority',
      val: '"high"',
      up: '2014-01-01T10:00:00.000Z'
    }];

    var create = function () {

      var attrs = function (partition) {
        return testUtils.attrsShouldEql(args.db, partition, [{
          name: 'priority',
          value: '"medium"',
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

      return queueAndProcess(createChanges).then(function () {
        return allDocs(null, createChanges[0].up);
      }).then(function () {
        return allAttrs();
      });
    };

    var destroy = function () {

      var attrs = function (partition) {
        return testUtils.attrsShouldEql(args.db, partition, [{
          name: 'priority',
          value: '"medium"',
          updated_at: createChanges[0].up
        }, {
          name: null,
          value: null,
          updated_at: deleteChanges[0].up
        }], true);
      };

      var allAttrs = function () {
        return attrs(constants.ALL).then(function () {
          return attrs(constants.RECENT);
        }).then(function () {
          return attrs(constants.LATEST);
        });
      };

      return queueAndProcess(deleteChanges).then(function () {
        return allDocs(deleteChanges[0].up, createChanges[0].up);
      }).then(function () {
        return allAttrs();
      });
    };

    var restore = function () {

      var allOrRecentAttrs = function (partition) {
        return testUtils.attrsShouldEql(args.db, partition, [{
          name: 'priority',
          value: '"high"',
          updated_at: restoreChanges[0].up
        }, {
          name: 'priority',
          value: '"medium"',
          updated_at: createChanges[0].up
        }, {
          name: null,
          value: null,
          updated_at: deleteChanges[0].up
        }], true);
      };

      var recentOrLatestAttrs = function (partition) {
        return testUtils.attrsShouldEql(args.db, partition, [{
          name: 'priority',
          value: '"medium"',
          updated_at: createChanges[0].up
        }, {
          name: null,
          value: null,
          updated_at: deleteChanges[0].up
        }], true);
      };

      var allAttrs = function () {
        return allOrRecentAttrs(constants.ALL).then(function () {
          return allOrRecentAttrs(constants.RECENT);
        }).then(function () {
          return recentOrLatestAttrs(constants.LATEST);
        });
      };

      return queueAndProcess(restoreChanges).then(function () {
        return allDocs(deleteChanges[0].up, restoreChanges[0].up);
      }).then(function () {
        return allAttrs();
      });
    };

    return create().then(function () {
      return destroy();
    }).then(function () {
      return restore();
    });
  });

  it('should only delete if latest', function () {
    // This is a form of an auto restore as the change to "priority" happened after the doc was
    // destroyed
    var changes = [{
      col: 'task',
      id: '1',
      name: 'thing',
      val: '"write a song"',
      up: '2014-01-01T10:00:00.000Z'
    }, {
      col: 'task',
      id: '1',
      name: 'priority',
      val: '"medium"',
      up: '2014-01-01T10:02:00.000Z'
    }];

    // Break up changes to ensure that delete is processed afterward updates

    var deleteChanges = [{
      col: 'task',
      id: '1',
      up: '2014-01-01T10:01:00.000Z'
    }]; // delete doc


    // When the delete is registered, the update is considered the end of the restore

    var allOrRecentAttrs = function (partition) {
      return testUtils.attrsShouldEql(args.db, partition, [{
          name: 'priority',
          value: '"medium"',
          updated_at: changes[1].up,
          seq: -1
        }, {
          name: 'priority',
          value: '"medium"',
          updated_at: changes[1].up
        },

        // TODO: is a dup, but is this OK?
        {
          name: 'thing',
          value: '"write a song"',
          updated_at: changes[0].up
        },

        {
          name: 'thing',
          value: '"write a song"',
          updated_at: changes[1].up,
          seq: -1
        }, {
          name: null,
          value: null,
          updated_at: deleteChanges[0].up
        }
      ], true);
    };

    var recentOrLatestAttrs = function (partition) {
      return testUtils.attrsShouldEql(args.db, partition, [{
        name: 'priority',
        value: '"medium"',
        updated_at: changes[1].up
      }, {
        name: 'thing',
        value: '"write a song"',
        updated_at: changes[1].up,
        seq: -1
      }, {
        name: null,
        value: null,
        updated_at: deleteChanges[0].up
      }], true);
    };

    var allAttrs = function () {
      return allOrRecentAttrs(constants.ALL).then(function () {
        return allOrRecentAttrs(constants.RECENT);
      }).then(function () {
        return recentOrLatestAttrs(constants.LATEST);
      });
    };

    return queueAndProcess(changes).then(function () {
      return queueAndProcess(deleteChanges);
    }).then(function () {
      return allDocs(null, changes[1].up);
    }).then(function () {
      return allAttrs();
    });
  });

});
