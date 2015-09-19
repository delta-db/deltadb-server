'use strict';

var constants = require('./constants'),
  Roles = require('./roles'),
  Users = require('./user/users'),
  Cols = require('./col/cols');

var ChangesQuery = function (sql, partition, since, limit, offset, all, userId) {
  this._sql = sql;
  this._partition = partition;
  this._since = since;
  this._limit = limit;
  this._offset = offset;
  this._all = all;
  this._userId = userId;
};

ChangesQuery.prototype._joinAttrPolicy = function (joins) {
  joins.left_joins['col_roles col_roles_attr'] = [
    ['col_roles_attr.col_id', '=', 'cols.id'], 'and', ['col_roles_attr.name', '=',
      this._partition + 'attrs.name'
    ], 'and', ['col_roles_attr.action', '=', '"' + constants.ACTION_READ + '"']
  ];

  joins.left_joins['user_roles user_roles_attr'] = [
    ['user_roles_attr.role_id', '=', 'col_roles_attr.role_id'], 'or', [
      'user_roles_attr.role_id', '=', '"' + Roles.ID_SUPER + '"'
    ]
  ];
};

ChangesQuery.prototype._joinColPolicy = function (joins) {
  joins.left_joins['col_roles col_roles_col'] = [
    ['col_roles_col.col_id', '=', 'cols.id'], 'and', ['col_roles_attr.id', '=', 'null'],
    'and', // no col_role for col_attr
    ['col_roles_col.name', '=', 'null'], 'and', ['col_roles_col.action', '=', '"' +
      constants.ACTION_READ + '"'
    ]
  ];

  joins.left_joins['user_roles user_roles_col'] = [
    ['user_roles_col.role_id', '=', 'col_roles_col.role_id'], 'or', [
      'user_roles_col.role_id', '=', '"' + Roles.ID_SUPER + '"'
    ]
  ];
};

ChangesQuery.prototype._joinAllAttrPolicy = function (joins) {
  joins.left_joins['col_roles col_roles_all_attr'] = [
    ['col_roles_col.id', '=', 'null'], 'and', // no col_role for col_doc
    ['col_roles_attr.id', '=', 'null'], 'and', // no col_role for col_attr
    ['col_roles_all_attr.col_id', '=', '"' + Cols.ID_ALL + '"'], 'and', [
      'col_roles_all_attr.name', '=', this._partition + 'attrs.name'
    ], 'and', ['col_roles_all_attr.action', '=', '"' + constants.ACTION_READ + '"']
  ];

  joins.left_joins['user_roles user_roles_all_attr'] = [
    ['user_roles_all_attr.role_id', '=', 'col_roles_all_attr.role_id'], 'or', [
      'user_roles_all_attr.role_id', '=', '"' + Roles.ID_SUPER + '"'
    ]
  ];
};

ChangesQuery.prototype._joinAllColPolicy = function (joins) {
  joins.left_joins['col_roles col_roles_all_col'] = [
    ['col_roles_col.id', '=', 'null'], 'and', // no col_role for col_doc
    ['col_roles_attr.id', '=', 'null'], 'and', // no col_role for col_attr
    ['col_roles_all_col.col_id', '=', '"' + Cols.ID_ALL + '"'], 'and', ['col_roles_all_attr.id',
      '=', 'null'
    ], 'and', // no col_role for all_attr
    ['col_roles_all_col.name', '=', 'null'], 'and', ['col_roles_all_col.action', '=', '"' +
      constants.ACTION_READ + '"'
    ]
  ];

  joins.left_joins['user_roles user_roles_all_col'] = [
    ['user_roles_all_col.role_id', '=', 'col_roles_all_col.role_id'], 'or', [
      'user_roles_all_col.role_id', '=', '"' + Roles.ID_SUPER + '"'
    ]
  ];
};

ChangesQuery.prototype._whereHasRole = function () {
  return [
    ['user_roles_all_attr.user_id', '=', '"' + this._userId + '"'], 'or', [
      'user_roles_all_col.user_id', '=', '"' + this._userId + '"'
    ], 'or', ['user_roles_attr.user_id', '=', '"' + this._userId + '"'], 'or', [
      'user_roles_col.user_id', '=', '"' + this._userId + '"'
    ]
  ];
};

ChangesQuery.prototype._whereIsOwner = function () {
  return [
    [
      ['col_roles_all_attr.role_id', '=', '"' + Roles.ID_OWNER + '"'], 'or', [
        'col_roles_all_col.role_id', '=', '"' + Roles.ID_OWNER + '"'
      ], 'or', ['col_roles_attr.role_id', '=', '"' + Roles.ID_OWNER + '"'], 'or', [
        'col_roles_col.role_id', '=', '"' + Roles.ID_OWNER + '"'
      ]
    ], 'and', [this._partition + 'docs.user_id', '=', '"' + this._userId + '"']
  ];
};

ChangesQuery.prototype._whereAllCanRead = function () {
  return [
    ['col_roles_all_attr.role_id', '=', '"' + Roles.ID_ALL + '"'], 'or', [
      'col_roles_all_col.role_id', '=', '"' + Roles.ID_ALL + '"'
    ], 'or', ['col_roles_attr.role_id', '=', '"' + Roles.ID_ALL + '"'], 'or', [
      'col_roles_col.role_id', '=', '"' + Roles.ID_ALL + '"'
    ]
  ];
};

ChangesQuery.prototype._order = function () {
  // Most DBs don't guarantee order unless an ORDER BY statement is used and we need our query to be
  // deterministic. MySQL: http://stackoverflow.com/questions/1949641/mysql-row-order-for-select-
  // from-table-name, Postgres: http://www.postgresql.org/docs/current/interactive/queries-
  // order.html. We need to order by the id as timestamps may not be unique and therefore sorting by
  // a timestamp is not deterministic.
  return [this._partition + 'attrs.id', 'asc'];
  // TODO: what happens when our ids overflow? Do we reset them? If so, ordering will fail. We could
  // take the db offline and adjust all the ids in one shot.
};


ChangesQuery.prototype._changesNestedSQL = function () {

  var self = this,
    hasRole = null;

  var attrs = {};
  attrs[self._partition + 'attrs.id'] = 'id';

  var joins = {
    joins: {},
    left_joins: {}
  };
  joins.joins[self._partition + 'docs'] = [self._partition + 'docs.id', '=', self._partition +
    'attrs.doc_id'
  ];
  joins.joins['cols'] = ['cols.id', '=', self._partition + 'docs.col_id'];

  // We have to join with col_roles four times as an attr policy overrides a doc policy and we need
  // to ensure that there is no attr policy before using the doc policy. And the col policy
  // overrides the db policy ($all).
  self._joinAttrPolicy(joins);
  self._joinColPolicy(joins);
  self._joinAllAttrPolicy(joins);
  self._joinAllColPolicy(joins);

  var where = null;
  if (self._since) {
    where = [self._partition + 'attrs.recorded_at', '>=', '"' + self._since.toISOString() + '"'];
  }

  if (!self._all) {
    var whereAll = ['omit', '=', 'false'];
    where = where ? [where, 'and', whereAll] : whereAll;
  }

  if (self._userId) { // logged in?
    joins.left_joins['users'] = ['users.id', '=', '"' + self._userId + '"'];
    hasRole = [
      this._whereHasRole(), 'or',

      this._whereIsOwner(), 'or',

      this._whereAllCanRead()
    ];
    hasRole = [
      ['users.status', '=', '"' + Users.STATUS_ENABLED + '"'], 'and', hasRole
    ];
  } else { // not logged in
    hasRole = this._whereAllCanRead();
  }
  where = where ? [where, 'and', hasRole] : hasRole;

  var replacements = [];
  var sql = self._sql.findSQL(attrs, self._partition + 'attrs', joins, where, null, null, null,
    null, null, null, replacements);

  return self._sql.build(sql, replacements);
};

// TODO: should changes return uuid of user who changed the data or should there be an option to
// return this?
ChangesQuery.prototype._changes = function () {

  var self = this;

  var attrs = {
    'cols.name': 'col'
  };
  attrs[self._partition + 'attrs.name'] = 'name';
  attrs[self._partition + 'attrs.value'] = 'val';
  attrs[self._partition + 'attrs.changed_by_user_id'] = 'auth'; // change to uid and get userUUID?
  attrs[self._partition + 'attrs.recorded_at'] = 're';
  attrs[self._partition + 'attrs.updated_at'] = 'up';
  attrs[self._partition + 'docs.uuid'] = 'id';

  var joins = {
    joins: {},
    left_joins: {}
  };
  joins.joins[self._partition + 'docs'] = [self._partition + 'docs.id', '=', self._partition +
    'attrs.doc_id'
  ];
  joins.joins['cols'] = ['cols.id', '=', self._partition + 'docs.col_id'];

  var nestedSQL = self._changesNestedSQL();

  // It is over 10 times faster to use a nested query than to use the DISTINCT keyword to ensure
  // that we only get a distinct set of changes. We can have duplicates as a user may have multiple
  // levels of access to the same attr.
  var where = [self._partition + 'attrs.id', 'in', '{' + nestedSQL + '}'];

  return self._sql.find(attrs, self._partition + 'attrs', joins, where, self._order(), self._limit,
    self._offset);
};

/*
// Note: save this code in case we decide to support a SQL DB that does not support nested queries.
// Using nested queries is much faster than using the DISTINCT keyword
// TODO: split into smaller functions!! This query is crazy, is there a better way?!?!
// TODO: should changes return uuid of user who changed the data or should there be an option to
// return this?
ChangesQuery.prototype._noNestingChanges = function (partition, since, limit, offset, all, userId) {

  var self = this,
    hasRole = null;

  var attrs = {
    'cols.name': 'col'
  };
  attrs[partition + 'attrs.name'] = 'name';
  attrs[partition + 'attrs.value'] = 'val';
  attrs[partition + 'attrs.changed_by_user_id'] = 'auth'; // change to uid and get userUUID?
  attrs[partition + 'attrs.recorded_at'] = 're';
  attrs[partition + 'attrs.updated_at'] = 'up';
  attrs[partition + 'docs.uuid'] = 'id';

  var joins = {
    joins: {},
    left_joins: {}
  };
  joins.joins[partition + 'docs'] = [partition + 'docs.id', '=', partition + 'attrs.doc_id'];
  joins.joins['cols'] = ['cols.id', '=', partition + 'docs.col_id'];

  // We have to join with col_roles four times as an attr policy overrides a doc policy and we need
  // to ensure that there is no attr policy before using the doc policy. And the col policy
  // overrides the db policy ($all).

  joins.left_joins['col_roles col_roles_col_attr'] = [
    ['col_roles_col_attr.col_id', '=', 'cols.id'], 'and', ['col_roles_col_attr.name', '=',
      partition + 'attrs.name'
    ], 'and', ['col_roles_col_attr.action', '=', '"' + constants.ACTION_READ + '"']
  ];

  joins.left_joins['user_roles user_roles_col_attr'] = [
    ['user_roles_col_attr.role_id', '=', 'col_roles_col_attr.role_id'], 'or', [
      'user_roles_col_attr.role_id', '=', '"' + Roles.ID_SUPER + '"'
    ]
  ];

  joins.left_joins['col_roles col_roles_col_doc'] = [
    ['col_roles_col_doc.col_id', '=', 'cols.id'], 'and', ['col_roles_col_attr.id', '=', 'null'],
    'and', // no col_role for col_attr
    ['col_roles_col_doc.name', '=', 'null'], 'and', ['col_roles_col_doc.action', '=', '"' +
      constants.ACTION_READ + '"'
    ]
  ];

  joins.left_joins['user_roles user_roles_col_doc'] = [
    ['user_roles_col_doc.role_id', '=', 'col_roles_col_doc.role_id'], 'or', [
      'user_roles_col_doc.role_id', '=', '"' + Roles.ID_SUPER + '"'
    ]
  ];

  joins.left_joins['col_roles col_roles_all_attr'] = [
    ['col_roles_col_doc.id', '=', 'null'], 'and', // no col_role for col_doc
    ['col_roles_col_attr.id', '=', 'null'], 'and', // no col_role for col_attr
    ['col_roles_all_attr.col_id', '=', '"' + Cols.ID_ALL + '"'], 'and', [
      'col_roles_all_attr.name', '=', partition + 'attrs.name'
    ], 'and', ['col_roles_all_attr.action', '=', '"' + constants.ACTION_READ + '"']
  ];

  joins.left_joins['user_roles user_roles_all_attr'] = [
    ['user_roles_all_attr.role_id', '=', 'col_roles_all_attr.role_id'], 'or', [
      'user_roles_all_attr.role_id', '=', '"' + Roles.ID_SUPER + '"'
    ]
  ];

  joins.left_joins['col_roles col_roles_all_doc'] = [
    ['col_roles_col_doc.id', '=', 'null'], 'and', // no col_role for col_doc
    ['col_roles_col_attr.id', '=', 'null'], 'and', // no col_role for col_attr
    ['col_roles_all_doc.col_id', '=', '"' + Cols.ID_ALL + '"'], 'and', ['col_roles_all_attr.id',
      '=', 'null'
    ], 'and', // no col_role for all_attr
    ['col_roles_all_doc.name', '=', 'null'], 'and', ['col_roles_all_doc.action', '=', '"' +
      constants.ACTION_READ + '"'
    ]
  ];

  joins.left_joins['user_roles user_roles_all_doc'] = [
    ['user_roles_all_doc.role_id', '=', 'col_roles_all_doc.role_id'], 'or', [
      'user_roles_all_doc.role_id', '=', '"' + Roles.ID_SUPER + '"'
    ]
  ];

  var where = null;
  if (since) {
    where = [partition + 'attrs.recorded_at', '>=', '"' + since.toISOString() + '"'];
  }

  if (!all) {
    var whereAll = ['omit', '=', 'false'];
    where = where ? [where, 'and', whereAll] : whereAll;
  }

  if (userId) { // logged in?
    joins.left_joins['users'] = ['users.id', '=', '"' + userId + '"'];
    hasRole = [
      ['user_roles_all_attr.user_id', '=', '"' + userId + '"'], 'or', [
        'user_roles_all_doc.user_id', '=', '"' + userId + '"'
      ], 'or', ['user_roles_col_attr.user_id', '=', '"' + userId + '"'], 'or', [
        'user_roles_col_doc.user_id', '=', '"' + userId + '"'
      ], 'or',

      [
        [
          ['col_roles_all_attr.role_id', '=', '"' + Roles.ID_OWNER + '"'], 'or', [
            'col_roles_all_doc.role_id', '=', '"' + Roles.ID_OWNER + '"'
          ], 'or', ['col_roles_col_attr.role_id', '=', '"' + Roles.ID_OWNER + '"'], 'or', [
            'col_roles_col_doc.role_id', '=', '"' + Roles.ID_OWNER + '"'
          ]
        ], 'and', [partition + 'docs.user_id', '=', '"' + userId + '"']
      ], 'or',

      ['col_roles_all_attr.role_id', '=', '"' + Roles.ID_ALL + '"'], 'or', [
        'col_roles_all_doc.role_id', '=', '"' + Roles.ID_ALL + '"'
      ], 'or', ['col_roles_col_attr.role_id', '=', '"' + Roles.ID_ALL + '"'], 'or', [
        'col_roles_col_doc.role_id', '=', '"' + Roles.ID_ALL + '"'
      ]
    ];
    hasRole = [
      ['users.status', '=', '"' + Users.STATUS_ENABLED + '"'], 'and', hasRole
    ];
  } else { // not logged in
    hasRole = [
      ['col_roles_all_attr.role_id', '=', '"' + Roles.ID_ALL + '"'], 'or', [
        'col_roles_all_doc.role_id', '=', '"' + Roles.ID_ALL + '"'
      ], 'or', ['col_roles_col_attr.role_id', '=', '"' + Roles.ID_ALL + '"'], 'or', [
        'col_roles_col_doc.role_id', '=', '"' + Roles.ID_ALL + '"'
      ]
    ];
  }
  where = where ? [where, 'and', hasRole] : hasRole;

  // TODO: removing use of distinct improves speed by a factor of 10!!!! NEED TO NEST QUERIES!!

  // There may be multiple user_roles or col_roles and postgres won't allow us to select an
  // attribute that isn't in the group by clause so we will select distinct values. TODO:
  // investigate efficiency gain by building nested query support into ORM and using it here.
  // var group = [partition + 'attrs.id'];
  var distinct = true;

  return self._sql.find(attrs, partition + 'attrs', joins, where, null, limit, offset, null,
      distinct)
    .then(function (results) {
      return self._formatChanges(results.rows);
    });
};
*/

module.exports = ChangesQuery;