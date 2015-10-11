'use strict';

// TODO: race conditions where doc record destroyed but another attr record needs to reference it--
// write unit tests to test for this

// TODO: trace every DB flow to make sure it is the most optimized that it can be - probably create
// a document that outlines all the queries needed for an operation

// TODO: (Globaly) Only protected function names need to start with underscore

var Promise = require('bluebird'),
  utils = require('../../utils');

var SQL = require('../../orm/sql/adapters/postgres'); // needs to be dynamic

var Globals = require('./globals'),
  Cols = require('./col/cols'),
  Users = require('./user/users'),
  Roles = require('./roles'),
  UserRoles = require('./user/user-roles'),
  ColRoles = require('./col/col-roles'),
  Policy = require('./policy'),
  Archive = require('./archive'),
  Attrs = require('./attr/attrs'),
  Docs = require('./doc/docs'),
  Queue = require('./queue/queue'),
  constants = require('./constants'),
  Process = require('./process'),
  Changes = require('./changes'),
  Partition = require('./partition'),
  QueueAttrRecs = require('./queue/queue-attr-recs'),
  config = require('../../../config'),
  log = require('../../utils/log');
// Sessions = require('./sessions');

var Part = function (dbName, sql) {
  this._dbName = dbName;
  this._sql = sql ? sql : new SQL(); // TODO: remove new SQL() as sql should always be injected
//  this._connected = false;

  this._globals = new Globals(this._sql);
  this._roles = new Roles(this._sql, this);
  this._userRoles = new UserRoles(this._sql);
  this._users = new Users(this._sql, this._roles, this._userRoles, this);
  this._colRoles = new ColRoles(this._sql);
  this._policy = new Policy(this._sql, this._roles, this._colRoles, this._userRoles);
  this._cols = new Cols(this._sql, this._policy);
  // this._sessions = new Sessions(this._sql, this._users);

  this._initPartitions();

  this._archive = new Archive(this._partitions, this._globals);
  this._attrs = new Attrs(this._partitions, this._policy, this._users, this._roles, this);
  this._docs = new Docs(this._partitions, this._attrs, this._policy, this._cols);
  this._attrs._docs = this._docs;
  this._queueAttrRecs = new QueueAttrRecs(this._sql);
  this._queue = new Queue(this._sql);
  this._process = new Process(this._sql, this._docs, this._users, this._queueAttrRecs,
    this._partitions, this._cols, this._policy, this._roles,
    this._userRoles, this._attrs, this);
  this._changes = new Changes(this._sql, this._globals, this._users);

  this._models = [this._globals, this._cols, this._users, this._roles, this._userRoles,
    this._colRoles, this._queueAttrRecs
    // this._sessions
  ];

  // TODO: causes "listener memory leak" as there is only one pg instance
  // this._addSqlErrorListener();
};

// TODO: causes "listener memory leak" as there is only one pg instance. Better way?
// Part.prototype._addSqlErrorListener = function () {
//   this._sql.on('error', function (err) {
//     log.warning('partitioner sql err=' + err.message);
//   });
// };

Part.prototype._initPartitions = function () {
  this._queued = new Partition(this._sql, constants.QUEUED, this._policy, this._userRoles, this);
  this._latest = new Partition(this._sql, constants.LATEST, this._policy, this._userRoles, this);
  this._recent = new Partition(this._sql, constants.RECENT, this._policy, this._userRoles, this);
  this._all = new Partition(this._sql, constants.ALL, this._policy, this._userRoles, this);
  this._partitions = {};
  this._partitions[constants.QUEUED] = this._queued;
  this._partitions[constants.LATEST] = this._latest;
  this._partitions[constants.RECENT] = this._recent;
  this._partitions[constants.ALL] = this._all;
};

Part.prototype._host = config.POSTGRES_HOST;
Part.prototype._dbUser = config.POSTGRES_USER;
Part.prototype._dbPwd = config.POSTGRES_PWD;
Part.prototype._port = null;

Part.prototype._DB_NAME_PREFIX = 'delta_';

Part.prototype._toUniqueDBName = function (dbName) {
  return this._DB_NAME_PREFIX + dbName;
};

// Part.prototype.batch = 100;

Part.prototype.createTables = function () {

  var promises = [];

  this._models.forEach(function (model) {
    promises.push(model.createTable());
  });

  utils.each(this._partitions, function (partition) {
    promises.push(partition.createTables());
  });

  return Promise.all(promises);
};

Part.prototype.truncateTables = function () {

  var promises = [];

  this._models.forEach(function (model) {
    promises.push(model.truncateTable());
  });

  utils.each(this._partitions, function (partition) {
    promises.push(partition.truncateTables());
  });

  return Promise.all(promises);
};

Part.prototype.queue = function (changes, quorum, superUUID) {
  return this._queue.queue(changes, quorum, superUUID);
};

Part.prototype.process = function () {
  return this._process.process();
};

Part.prototype.archive = function (before) {
  return this._archive.archive(before);
};

Part.prototype.changes = function (since, history, limit, offset, all, userId) {
  return this._changes.changes(since, history, limit, offset, all, userId);
};

Part.prototype.connect = function () {
console.log('Part.prototype.connect, dbName=' + this._dbName + ', host=' + this._host + ', dbUser=' + this._dbUser);
  // TODO: throw error if _dbName is reserved
  return this._sql.connect(this._toUniqueDBName(this._dbName), this._host, this._dbUser,
    this._dbPwd, this._port);

// self._dbPwd).then(function () {
//   self._connected = true;
// });
};

// Part.prototype.connect = function () {
//   // TODO: throw error if _dbName is reserved
//   var self = this;
//   return self._sql.connect(self._toUniqueDBName(self._dbName), self._host, self._dbUser,
//     self._dbPwd);
//
// // self._dbPwd).then(function () {
// //   self._connected = true;
// // });
// };

Part.prototype.createDatabase = function () {
  var self = this;
console.log('Part.prototype.createDatabase1, self._dbUser=', self._dbUser);
  return self._sql.createAndUse(self._toUniqueDBName(self._dbName), self._host, self._dbUser,
    self._dbPwd).then(function () {
console.log('Part.prototype.createDatabase2, self._dbUser=', self._dbUser);
    return self.createTables();
  });
};

// TODO: rename to truncate?
Part.prototype.truncateDatabase = function () {
  return this.truncateTables();
};

// TODO: rename to destroy?
Part.prototype.destroyDatabase = function () {
console.log('Part.prototype.destroyDatabase');
// console.log('this._dbUser=', this._dbUser);
// process.exit();
// var self = this, promise = null;
// if (self._connected) {
//   promise = Promise.resolve();
// } else {
//   promise = self.connect();
// }
// return promise.then(function () {
//   return self._sql.dropAndCloseDatabase(true); // force close of all conns first
// });

  // force close of all conns first
  return this._sql.dropAndCloseDatabase(this._toUniqueDBName(this._dbName), this._host,
    this._dbUser, this._dbPwd, this._port, true);
};

// TODO: rename to disconnect?
Part.prototype.closeDatabase = function () {
  return this._sql.close();
// var self = this;
// return self._sql.close().then(function () {
//   self._connected = false;
// });
};

Part.prototype.createAnotherDatabase = function (dbName) {
  // Create a different DB and then just close it as another partitioner will manage it
  log.info('creating another DB ' + dbName);
  var sql = new SQL(); // TODO: pass in constructor
  var part = new Part(dbName, sql);
console.log('createAnotherDatabase1');
  return this._users.getSuperUser().then(function (user) {
console.log('createAnotherDatabase2');
    // Default other DB's super user salt and pwd so that it matches "ours"
    Users.SUPER_SALT = user.salt;
    Users.SUPER_PWD = user.password;
    return part.createDatabase();
  }).then(function () {
console.log('createAnotherDatabase3');

    return part.closeDatabase();

}).then(function () {
console.log('createAnotherDatabase4');

  });
};

Part.prototype.destroyAnotherDatabase = function (dbName) {
  // Destroy a different DB and then just close it as another partitioner will manage it
  log.info('destroying another DB ' + dbName);
  var sql = new SQL(); // TODO: pass in constructor
  var part = new Part(dbName, sql);
//  return part.connect().then(function () {
  return part.destroyDatabase();
//  });
};

module.exports = Part;
