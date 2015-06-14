'use strict';

var Promise = require('bluebird'),
  inherits = require('inherits'),
  MongoClient = require('mongodb').MongoClient,
  AbstractAdapter = require('../../adapter'),
  DB = require('./db');

var Adapter = function () {};

inherits(Adapter, AbstractAdapter);

// opts: host, port, db, username, password
Adapter.prototype.connect = function (opts) {
  // TODO: username & password
  var url = 'mongodb://' + opts.host + (opts.port ? ':' + opts.port : '') + '/' + opts.db,
    connect = Promise.promisify(MongoClient.connect);
  return connect(url).then(function (db) {
    return new DB(db);
  });
};

module.exports = Adapter;