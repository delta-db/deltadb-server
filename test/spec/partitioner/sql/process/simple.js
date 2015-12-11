'use strict';

// TODO: split into smaller files!!

// TODO: remove destroyed_at from attrs

var partUtils = require('../utils'),
  constants = require('../../../../../scripts/partitioner/sql/constants'),
  ProcTestUtils = require('./utils');

describe('simple', function () {

  var args = partUtils.init(this, beforeEach, afterEach, null, before, after);
  var utils = args.utils;

  var procTestUtils = null;

  beforeEach(function () {
    procTestUtils = new ProcTestUtils(args.db);
  });

  var createChanges = [{
    col: 'task',
    id: '1',
    name: 'thing',
    val: '"sing a song"',
    up: '2014-01-01T10:00:00.000Z'
  }];

  var create = function () {

    var attrs = function (partition) {
      return utils.attrsShouldEql(args.db, partition, [{
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

    return procTestUtils.queueAndProcess(createChanges).then(function () {
      return procTestUtils.allDocs(null, createChanges[0].up);
    }).then(function () {
      return allAttrs();
    });
  };

  var updateChanges = [{
    col: 'task',
    id: '1',
    name: 'thing',
    val: '"write a song"',
    up: '2014-01-01T10:00:00.100Z'
  }];

  var update = function () {

    var allOrRecentAttrs = function (partition) {
      return utils.attrsShouldEql(args.db, partition, [{
        name: 'thing',
        value: '"sing a song"',
        updated_at: createChanges[0].up
      }, {
        name: 'thing',
        value: '"write a song"',
        updated_at: updateChanges[0].up
      }], true);
    };

    var latestAttrs = function () {
      return utils.attrsShouldEql(args.db, constants.LATEST, [{
        name: 'thing',
        value: '"write a song"',
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
    name: 'thing',
    up: '2014-01-01T10:02:00.000Z'
  }];

  var destroyAttr = function () {

    var allOrRecentAttrs = function (partition) {
      return utils.attrsShouldEql(args.db, partition, [{
        name: 'thing',
        value: '"sing a song"',
        updated_at: createChanges[0].up
      }, {
        name: 'thing',
        value: '"write a song"',
        updated_at: updateChanges[0].up
      }, {
        name: 'thing',
        value: null,
        updated_at: destroyAttrChanges[0].up
      }], true);
    };

    var recentOrLatestAttrs = function (partition) {
      return utils.attrsShouldEql(args.db, partition, [{
        name: 'thing',
        value: null,
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

  var destroyDocChanges = [{
    col: 'task',
    id: '1',
    up: '2014-01-01T10:03:00.000Z'
  }];

  var destroyDoc = function () {

    var allOrRecentAttrs = function (partition) {
      return utils.attrsShouldEql(args.db, partition, [{
        name: 'thing',
        value: '"sing a song"',
        updated_at: createChanges[0].up
      }, {
        name: 'thing',
        value: '"write a song"',
        updated_at: updateChanges[0].up
      }, {
        name: 'thing',
        value: null,
        updated_at: destroyAttrChanges[0].up
      }, {
        name: null,
        value: null,
        updated_at: destroyDocChanges[0].up
      }], true);
    };

    var latestAttrs = function () {
      return utils.attrsShouldEql(args.db, constants.LATEST, [{
        name: 'thing',
        value: null,
        updated_at: destroyAttrChanges[0].up
      }, {
        name: null,
        value: null,
        updated_at: destroyDocChanges[0].up
      }], true);
    };

    var allAttrs = function () {
      return allOrRecentAttrs(constants.ALL).then(function () {
        return allOrRecentAttrs(constants.RECENT);
      }).then(function () {
        return latestAttrs();
      });
    };

    return procTestUtils.queueAndProcess(destroyDocChanges).then(function () {
      return procTestUtils.allDocs(destroyDocChanges[0].up, destroyAttrChanges[0].up);
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
    }).then(function () {
      return destroyDoc();
    });
  });

  it('should process seq nums', function () {

    var changes = [{
      col: 'task',
      id: '1',
      name: 'thing',
      val: '"sing a song"',
      up: '2014-01-01T10:00:00.300Z'
    }, {
      col: 'task',
      id: '1',
      name: 'thing',
      val: '"write a song"',
      up: '2014-01-01T10:00:00.300Z',
      seq: 1
    }];

    var allOrRecentAttrs = function (partition) {
      return utils.attrsShouldEql(args.db, partition, [{
        name: 'thing',
        value: '"sing a song"',
        updated_at: changes[0].up
      }, {
        name: 'thing',
        value: '"write a song"',
        updated_at: changes[1].up,
        seq: 1
      }], true);
    };

    var latestAttrs = function () {
      return utils.attrsShouldEql(args.db, constants.LATEST, [{
        name: 'thing',
        value: '"write a song"',
        updated_at: changes[1].up,
        seq: 1
      }], true);
    };

    var allAttrs = function () {
      return allOrRecentAttrs(constants.ALL).then(function () {
        return allOrRecentAttrs(constants.RECENT);
      }).then(function () {
        return latestAttrs();
      });
    };

    return procTestUtils.queueAndProcess(changes).then(function () {
      return procTestUtils.allDocs(null, changes[1].up);
    }).then(function () {
      return allAttrs();
    });

  });

  it('should process doc deletion with same timestamp', function () {

    // Note: there is no notion of a seq num for a doc deletion so we just assume that the doc
    // deletion is the latest change

    var changes = [{
      col: 'task',
      id: '1',
      name: 'priority',
      val: '"high"',
      up: '2014-01-01T10:00:00.000Z'
    }, {
      col: 'task',
      id: '1',
      up: '2014-01-01T10:00:00.000Z'
    }];

    var allOrRecentOrLatestAttrs = function (partition) {
      return utils.attrsShouldEql(args.db, partition, [{
        name: 'priority',
        value: '"high"',
        updated_at: changes[0].up
      }, {
        name: null,
        value: null,
        updated_at: changes[1].up
      }], true);
    };

    var allAttrs = function () {
      return allOrRecentOrLatestAttrs(constants.ALL).then(function () {
        return allOrRecentOrLatestAttrs(constants.RECENT);
      }).then(function () {
        return allOrRecentOrLatestAttrs(constants.LATEST);
      });
    };

    return procTestUtils.queueAndProcess(changes).then(function () {
      return procTestUtils.allDocs(changes[1].up, changes[0].up);
    }).then(function () {
      return allAttrs();
    });

  });

  it('should process doc deletion with same timestamp out of order', function () {

    // Note: there is no notion of a seq num for a doc deletion so we just assume that the doc
    // deletion is the latest change

    var changes = [{
      col: 'task',
      id: '1',
      up: '2014-01-01T10:00:00.000Z'
    }, {
      col: 'task',
      id: '1',
      name: 'priority',
      val: '"high"',
      up: '2014-01-01T10:00:00.000Z'
    }];

    var partitionAttrs = function (partition) {
      return utils.attrsShouldEql(args.db, partition, [{
        name: 'priority',
        value: '"high"',
        updated_at: changes[0].up
      }, {
        name: null,
        value: null,
        updated_at: changes[1].up
      }], true);
    };

    var allAttrs = function () {
      return partitionAttrs(constants.ALL).then(function () {
        return partitionAttrs(constants.RECENT);
      }).then(function () {
        return partitionAttrs(constants.LATEST);
      });
    };

    return procTestUtils.queueAndProcess(changes).then(function () {
      return procTestUtils.allDocs(changes[0].up, changes[1].up);
    }).then(function () {
      return allAttrs();
    });

  });

  it('should process attr deletion with same timestamp', function () {

    var changes = [{
      col: 'task',
      id: '1',
      name: 'priority',
      val: '"high"',
      up: '2014-01-01T10:00:00.000Z'
    }, {
      col: 'task',
      id: '1',
      name: 'priority',
      up: '2014-01-01T10:00:00.000Z',
      seq: 1
    }];

    var allOrRecentAttrs = function (partition) {
      return utils.attrsShouldEql(args.db, partition, [{
        name: 'priority',
        value: '"high"',
        updated_at: changes[0].up
      }, {
        name: 'priority',
        value: null,
        updated_at: changes[1].up,
        seq: 1
      }], true);
    };

    var latestAttrs = function () {
      return utils.attrsShouldEql(args.db, constants.LATEST, [{
        name: 'priority',
        value: null,
        updated_at: changes[1].up,
        seq: 1
      }], true);
    };

    var allAttrs = function () {
      return allOrRecentAttrs(constants.ALL).then(function () {
        return allOrRecentAttrs(constants.RECENT);
      }).then(function () {
        return latestAttrs();
      });
    };

    return procTestUtils.queueAndProcess(changes).then(function () {
      return procTestUtils.allDocs(null, changes[0].up);
    }).then(function () {
      return allAttrs();
    });

  });

  it('should process attr deletion with same timestamp', function () {

    var changes = [{
      col: 'task',
      id: '1',
      name: 'priority',
      up: '2014-01-01T10:00:00.000Z'
    }, {
      col: 'task',
      id: '1',
      name: 'priority',
      val: '"high"',
      up: '2014-01-01T10:00:00.000Z',
      seq: 1
    }];

    var allOrRecentAttrs = function (partition) {
      return utils.attrsShouldEql(args.db, partition, [{
        name: 'priority',
        value: null,
        updated_at: changes[0].up
      }, {
        name: 'priority',
        value: '"high"',
        updated_at: changes[1].up,
        seq: 1
      }], true);
    };

    var latestAttrs = function () {
      return utils.attrsShouldEql(args.db, constants.LATEST, [{
        name: 'priority',
        value: '"high"',
        updated_at: changes[1].up,
        seq: 1
      }], true);
    };

    var allAttrs = function () {
      return allOrRecentAttrs(constants.ALL).then(function () {
        return allOrRecentAttrs(constants.RECENT);
      }).then(function () {
        return latestAttrs(constants.LATEST);
      });
    };

    return procTestUtils.queueAndProcess(changes).then(function () {
      return procTestUtils.allDocs(null, changes[1].up);
    }).then(function () {
      return allAttrs();
    });

  });

  it('should take higher value', function () {

    var changes = [{
      col: 'task',
      id: '1',
      name: 'thing',
      val: '"sing a song"',
      up: '2014-01-01T10:00:00.300Z'
    }, {
      col: 'task',
      id: '1',
      name: 'thing',
      val: '"write a song"',
      up: '2014-01-01T10:00:00.300Z'
    }, {
      col: 'task',
      id: '1',
      name: 'thing',
      val: '"play a song"',
      up: '2014-01-01T10:00:00.300Z'
    }];

    var allOrRecentAttrs = function (partition) {
      return utils.attrsShouldEql(args.db, partition, [{
        name: 'thing',
        value: '"play a song"',
        updated_at: changes[2].up
      }, {
        name: 'thing',
        value: '"sing a song"',
        updated_at: changes[0].up
      }, {
        name: 'thing',
        value: '"write a song"',
        updated_at: changes[1].up
      }], true);
    };

    var latestAttrs = function () {
      return utils.attrsShouldEql(args.db, constants.LATEST, [{
        name: 'thing',
        value: '"write a song"',
        updated_at: changes[1].up
      }], true);
    };

    var allAttrs = function () {
      return allOrRecentAttrs(constants.ALL).then(function () {
        return allOrRecentAttrs(constants.RECENT);
      }).then(function () {
        return latestAttrs();
      });
    };

    return procTestUtils.queueAndProcess(changes).then(function () {
      return procTestUtils.allDocs(null, changes[1].up);
    }).then(function () {
      return allAttrs();
    });
  });

  it('should take latest', function () {

    var changes = [{
      col: 'task',
      id: '1',
      name: 'thing',
      val: '"sing a song"',
      up: '2014-01-01T10:03:00.300Z'
    }, {
      col: 'task',
      id: '1',
      name: 'thing',
      val: '"write a song"',
      up: '2014-01-01T10:01:00.300Z'
    }, {
      col: 'task',
      id: '1',
      name: 'thing',
      val: '"play a song"',
      up: '2014-01-01T10:02:00.300Z'
    }];

    var allOrRecentAttrs = function (partition) {
      return utils.attrsShouldEql(args.db, partition, [{
        name: 'thing',
        value: '"write a song"',
        updated_at: changes[1].up
      }, {
        name: 'thing',
        value: '"play a song"',
        updated_at: changes[2].up
      }, {
        name: 'thing',
        value: '"sing a song"',
        updated_at: changes[0].up
      }], true);
    };

    var latestAttrs = function () {
      return utils.attrsShouldEql(args.db, constants.LATEST, [{
        name: 'thing',
        value: '"sing a song"',
        updated_at: changes[0].up
      }], true);
    };

    var allAttrs = function () {
      return allOrRecentAttrs(constants.ALL).then(function () {
        return allOrRecentAttrs(constants.RECENT);
      }).then(function () {
        return latestAttrs();
      });
    };

    return procTestUtils.queueAndProcess(changes).then(function () {
      return procTestUtils.allDocs(null, changes[0].up);
    }).then(function () {
      return allAttrs();
    });
  });

  it('should update earlier value even if doc destroyed', function () {

    var changes = [{
      col: 'task',
      id: '1',
      name: 'priority',
      val: '"high"',
      up: '2014-01-01T10:00:00.300Z'
    }, {
      col: 'task',
      id: '1',
      up: '2014-01-01T10:20:00.300Z'
    }, {
      col: 'task',
      id: '1',
      name: 'priority',
      val: '"low"',
      up: '2014-01-01T10:01:00.300Z'
    }];

    var allOrRecentAttrs = function (partition) {
      return utils.attrsShouldEql(args.db, partition, [{
        name: 'priority',
        value: '"high"',
        updated_at: changes[0].up
      }, {
        name: 'priority',
        value: '"low"',
        updated_at: changes[2].up
      }, {
        name: null,
        value: null,
        updated_at: changes[1].up
      }], true);
    };

    var recentOrLatestAttrs = function (partition) {
      return utils.attrsShouldEql(args.db, partition, [{
        name: 'priority',
        value: '"low"',
        updated_at: changes[2].up
      }, {
        name: null,
        value: null,
        updated_at: changes[1].up
      }], true);
    };

    var allAttrs = function () {
      return allOrRecentAttrs(constants.ALL).then(function () {
        return allOrRecentAttrs(constants.RECENT);
      }).then(function () {
        return recentOrLatestAttrs(constants.LATEST);
      });
    };

    return procTestUtils.queueAndProcess(changes).then(function () {
      return procTestUtils.allDocs(changes[1].up, changes[2].up);
    }).then(function () {
      return allAttrs();
    });
  });

  it('should update earlier value even if attr destroyed', function () {

    var changes = [{
      col: 'task',
      id: '1',
      name: 'priority',
      val: '"high"',
      up: '2014-01-01T10:00:00.300Z'
    }, {
      col: 'task',
      id: '1',
      name: 'priority',
      up: '2014-01-01T10:20:00.300Z'
    }, {
      col: 'task',
      id: '1',
      name: 'priority',
      val: '"low"',
      up: '2014-01-01T10:01:00.300Z'
    }];

    var allOrRecentAttrs = function (partition) {
      return utils.attrsShouldEql(args.db, partition, [{
        name: 'priority',
        value: '"high"',
        updated_at: changes[0].up
      }, {
        name: 'priority',
        value: '"low"',
        updated_at: changes[2].up
      }, {
        name: 'priority',
        value: null,
        updated_at: changes[1].up
      }], true);
    };

    var latestAttrs = function () {
      return utils.attrsShouldEql(args.db, constants.LATEST, [{
        name: 'priority',
        value: null,
        updated_at: changes[1].up
      }], true);
    };

    var allAttrs = function () {
      return allOrRecentAttrs(constants.ALL).then(function () {
        return allOrRecentAttrs(constants.RECENT);
      }).then(function () {
        return latestAttrs();
      });
    };

    return procTestUtils.queueAndProcess(changes).then(function () {
      return procTestUtils.allDocs(null, changes[1].up);
    }).then(function () {
      return allAttrs();
    });
  });

  it('should process earlier update recorded after doc delete', function () {

    // e.g.
    // 1. doc delete, up:8AM
    // 2. doc update, up:7AM

    var changes = [{
      col: 'task',
      id: '1',
      up: '2014-01-01T08:00:00.000Z'
    }, {
      col: 'task',
      id: '1',
      name: 'priority',
      val: '"medium"',
      up: '2014-01-01T07:00:00.000Z'
    }];

    var partitionAttrs = function (partition) {
      return utils.attrsShouldEql(args.db, partition, [{
        name: 'priority',
        value: '"medium"',
        updated_at: changes[1].up
      }, {
        name: null,
        value: null,
        updated_at: changes[0].up
      }], true);
    };

    var allAttrs = function () {
      return partitionAttrs(constants.ALL).then(function () {
        return partitionAttrs(constants.RECENT);
      }).then(function () {
        return partitionAttrs(constants.LATEST);
      });
    };

    return procTestUtils.queueAndProcess(changes).then(function () {
      return procTestUtils.allDocs(changes[0].up, changes[1].up);
    }).then(function () {
      return allAttrs();
    });
  });

  it('should honor attr delete before doc delete', function () {

    // e.g.
    // 1. doc create, 5AM
    // 1. doc delete, up: 7AM
    // 2. attr delete, up: 6AM

    var changes = [{
      col: 'task',
      id: '1',
      name: 'priority',
      val: '"high"',
      up: '2014-01-01T05:00:00.000Z'
    }, {
      col: 'task',
      id: '1',
      up: '2014-01-01T07:00:00.000Z'
    }, {
      col: 'task',
      id: '1',
      name: 'priority',
      up: '2014-01-01T06:00:00.000Z'
    }];

    var allOrRecentAttrs = function (partition) {
      return utils.attrsShouldEql(args.db, partition, [{
        name: 'priority',
        value: '"high"',
        updated_at: changes[0].up
      }, {
        name: 'priority',
        value: null,
        updated_at: changes[2].up
      }, {
        name: null,
        value: null,
        updated_at: changes[1].up
      }], true);
    };

    var recentOrLatestAttrs = function (partition) {
      // Attr deletion causes last value to be null before doc delete
      return utils.attrsShouldEql(args.db, partition, [{
        name: 'priority',
        value: null,
        updated_at: changes[2].up
      }, {
        name: null,
        value: null,
        updated_at: changes[1].up
      }], true);
    };

    var allAttrs = function () {
      return allOrRecentAttrs(constants.ALL).then(function () {
        return allOrRecentAttrs(constants.RECENT);
      }).then(function () {
        return recentOrLatestAttrs(constants.LATEST);
      });
    };

    return procTestUtils.queueAndProcess(changes).then(function () {
      return procTestUtils.allDocs(changes[1].up, changes[2].up);
    }).then(function () {
      return allAttrs();
    });
  });

  it('should honor later doc deletion', function () {

    var changes = [{
      col: 'task',
      id: '1',
      name: 'thing',
      val: '"write a song"',
      up: '2014-01-01T10:00:00.000Z'
    }, {
      col: 'task',
      id: '1',
      name: 'thing',
      up: '2014-01-01T10:01:00.000Z'
    }, {
      col: 'task',
      id: '1',
      name: 'priority',
      val: '"medium"',
      up: '2014-01-01T10:00:00.000Z'
    }, {
      col: 'task',
      id: '1',
      name: 'priority',
      val: '"high"',
      up: '2014-01-01T10:01:00.000Z'
    }];

    // We need to process the delete separately so that we can reliably determine the doc updated_at
    // date as deletions may be recorded first as they don't need to first check for an auto
    // restore. Recall that the updated_at at the doc layer is not updated if the update is after
    // the doc has been destroyed as we need to ensure that an update is only registered if it is
    // the latest change.
    var deleteChanges = [{
      col: 'task',
      id: '1',
      up: '2014-01-01T10:02:00.000Z'
    }];

    var allOrRecentAttrs = function (partition) {
      return utils.attrsShouldEql(args.db, partition, [{
        name: 'priority',
        value: '"medium"',
        updated_at: changes[2].up
      }, {
        name: 'priority',
        value: '"high"',
        updated_at: changes[3].up
      }, {
        name: 'thing',
        value: '"write a song"',
        updated_at: changes[0].up
      }, {
        name: 'thing',
        value: null,
        updated_at: changes[1].up
      }, {
        name: null,
        value: null,
        updated_at: deleteChanges[0].up
      }], true);
    };

    var latestAttrs = function () {
      return utils.attrsShouldEql(args.db, constants.LATEST, [{
        name: 'priority',
        value: '"high"',
        updated_at: changes[3].up
      }, {
        name: 'thing',
        value: null,
        updated_at: changes[1].up
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
        return latestAttrs();
      });
    };

    return procTestUtils.queueAndProcess(changes).then(function () {
      return procTestUtils.queueAndProcess(deleteChanges);
    }).then(function () {
      return procTestUtils.allDocs(deleteChanges[0].up, changes[3].up);
    }).then(function () {
      return allAttrs();
    });
  });

  it('should honor doc delete date after doc delete', function () {

    var changes = [{
      col: 'task',
      id: '1',
      name: 'priority',
      val: '"high"',
      up: '2014-01-01T05:00:00.000Z'
    }, {
      col: 'task',
      id: '1',
      up: '2014-01-01T06:00:00.000Z'
    }, {
      col: 'task',
      id: '1',
      up: '2014-01-01T07:00:00.000Z'
    }];

    var allOrRecentAttrs = function (partition) {
      return utils.attrsShouldEql(args.db, partition, [{
        name: 'priority',
        value: '"high"',
        updated_at: changes[0].up
      }, {
        name: null,
        value: null,
        updated_at: changes[1].up
      }, {
        name: null,
        value: null,
        updated_at: changes[2].up
      }], true);
    };

    var recentOrLatestAttrs = function (partition) {
      // Attr deletion causes last value to be null before doc delete
      return utils.attrsShouldEql(args.db, partition, [{
        name: 'priority',
        value: '"high"',
        updated_at: changes[0].up
      }, {
        name: null,
        value: null,
        updated_at: changes[2].up
      }], true);
    };

    var allAttrs = function () {
      return allOrRecentAttrs(constants.ALL).then(function () {
        return allOrRecentAttrs(constants.RECENT);
      }).then(function () {
        return recentOrLatestAttrs(constants.LATEST);
      });
    };

    // Separate changes to guarantee update before delete
    return procTestUtils.queueAndProcess([changes[0]]).then(function () {
      return procTestUtils.queueAndProcess([changes[1], changes[2]]);
    }).then(function () {
      return procTestUtils.allDocs(changes[2].up, changes[0].up);
    }).then(function () {
      return allAttrs();
    });
  });

});
