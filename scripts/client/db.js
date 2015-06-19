'use strict';

// TODO: later db should be passed in a constructor so that it doesn't have to be passed to sync??

var inherits = require('inherits'),
  Promise = require('bluebird'),
  utils = require('../utils'),
  DBWrapper = require('../orm/nosql/wrapper/db');

var DB = function () {
  DBWrapper.apply(this, arguments); // apply parent constructor
  this._collections = {};
  this._since = null; // TODO: persist w/ some local store for globals
  this._retryAfterSecs = 180000;
};

inherits(DB, DBWrapper);

DB.prototype.use = function (name) {
  var self = this;
  return new Promise(function (resolve) {
    if (self._collections[name]) {
      resolve(self._collections[name]);
    } else {
      self._db._db = self; // allow the wrapping DB to be pased down to the wrapping item
      var use = self._db.use(name).then(function (collection) {
        self._collections[name] = collection;
        self._emitColCreate(collection);
        return collection;
      });
      resolve(use);
    }
  });
};

DB.prototype._emitColCreate = function (col) {
  this.emit('col:create', col);
  this._adapter._emit('col:create', col); // also bubble up to adapter layer
};

// TODO: defer to collection or item to retrieve from correct layer
DB.prototype._localChanges = function (retryAfter, returnSent) {
  var self = this,
    now = (new Date()).getTime();
  retryAfter = typeof retryAfter === 'undefined' ? 0 : retryAfter;
  return new Promise(function (resolve) {
    var changes = [];
    utils.each(self._collections, function (collection) {
      utils.each(collection._items, function (item) {
        utils.each(item._changes, function (change) {
          // Use >= to ensure we get all changes when retryAfter=0
          if (!change.sent || now >= change.sent.getTime() + retryAfter) { // never sent or retry?
            var chng = utils.clone(change); // clone so that we don't modify original data
            if (!returnSent) {
              delete chng.sent; // server doesn't need sent
            }
            chng.col = collection._name;
            chng.id = item.id();
            chng.up = change.up.toISOString();
            if (chng.val) { // don't set val if falsy
              chng.val = JSON.stringify(chng.val);
            }
            // if (!change.seq) {
            //   delete chng.seq; // same some bandwidth and clear the seq if 0
            // }
            changes.push(chng);
            change.sent = new Date();
          }
        });
      });
    });
    resolve(changes);
  });
};

DB.prototype._setChange = function (change) {
  return this.use(change.col).then(function (collection) {
    return collection._setChange(change);
  });
};

// Process changes sequentially or else duplicate collections can be created
DB.prototype._setChanges = function (changes) {
  var self = this,
    chain = Promise.resolve();
  if (!changes) {
    return chain;
  }
  changes.forEach(function (change) {
    chain = chain.then(function () {
      return self._setChange(change);
    });
  });
  return chain;
};

DB.prototype.sync = function (db, quorum) {
  var self = this,
    since = null;
  return self._localChanges(self._retryAfter).then(function (changes) {
    return db.queue(changes, quorum);
  }).then(function () {
    since = new Date();
    return db.changes(self._since);
  }).then(function (changes) {
    return self._setChanges(changes);
  }).then(function () {
    self._since = since;
  });
};

DB.prototype._emit = function () { // event, arg1, ... argN
  var args = utils.toArgsArray(arguments);
  this.emit.apply(this, args);
  this._adapter._emit.apply(this._adapter, args); // also bubble up to adapter layer
};

module.exports = DB;