'use strict';

// TODO: docs/changes need to be in store (i.e. separate instance of orm) so that they can be
// persistent

var inherits = require('inherits'),
  Promise = require('bluebird'),
  CommonCollection = require('../orm/nosql/common/collection'),
  utils = require('../utils'),
  clientUtils = require('./utils'),
  Doc = require('./doc'),
  Cursor = require('../orm/nosql/adapters/mem/cursor'), // TODO: remove and use store instead!!
  FilterCursor = require('../orm/nosql/common/cursor/filter'); // TODO: remove and use store instead
// SortCursor = require('../orm/nosql/common/cursor/sort'), // TODO: remove and use store instead
// where = require('../orm/nosql/common/where'); // TODO: remove and use store instead!!
// order = require('../orm/nosql/common/order'); // TODO: remove and use store instead!!

var Collection = function (name, db, store) {
  CommonCollection.apply(this, arguments); // apply parent constructor
  this._store = store;
  this._docs = {}; // TODO: remove and use store instead!!
};

inherits(Collection, CommonCollection);

Collection.prototype.doc = function (data) {
  return new Doc(data, this);
};

Collection.prototype._setChange = function (change) {
  var doc = this._getDoc(change.id),
    promise = null;
  if (!doc) {
    doc = this.doc();
    doc.id(change.id);
    promise = this._register(doc);
  } else {
    promise = Promise.resolve();
  }
  // TODO: in future, if sequence of changes for same doc then set for all changes and then issue a
  // single save?
  return promise.then(function () {
    return doc._setChange(change);
  });
};

Collection.prototype._emit = function (evnt) { // evnt, arg1, ... argN
  var args = utils.toArgsArray(arguments);
  this.emit.apply(this, args);

  this._db._emit.apply(this._db, args); // also bubble up to db layer

  // Prevent infinite recursion
  if (evnt !== 'col:create' && evnt !== 'col:update') {
    this._emit.apply(this, ['col:update', this]);
  }

  if (evnt === 'doc:record') {
    this._emit.apply(this, ['col:record', this]);
  }
};

Collection.prototype._emitColDestroy = function () {
  this._emit('col:destroy', this);
};

// TODO: use store instead of mem
Collection.prototype._register = function (doc) {
  this._docs[doc.id()] = doc;
  doc._emitDocCreate();
  return Promise.resolve();
};

// TODO: use store instead of mem
// Collection.prototype._unregister = function (doc) {
//   delete this._docs[doc.id()];
//   return Promise.resolve();
// };

// Collection.prototype._register = function (doc) {
//   return this._collection._register.apply(this, arguments).then(function () {
// console.log('_register-1');
//     doc._emitDocCreate();
//   });
// };

Collection.prototype.destroy = function () {
  this._emitColDestroy(); // TODO: move to layer above
  return Promise.resolve();
  // var self = this;
  // return self._collection.destroy.apply(this, arguments).then(function () {
  //   self._emitColDestroy();
  // });
};

Collection.prototype.policy = function (policy) {
  var doc = this.doc();
  return doc.policy(policy);
};

// Shouldn't be called directly as the colName needs to be set properly
Collection.prototype._createUser = function (userUUID, username, password, status) {
  var doc = this.doc();
  doc.id(clientUtils.toDocUUID(userUUID));
  return doc._createUser(userUUID, username, password, status);
};

Collection.prototype._addRole = function (userUUID, roleName) {
  var doc = this.doc();
  return doc._addRole(userUUID, roleName);
};

Collection.prototype._removeRole = function (userUUID, roleName) {
  var doc = this.doc();
  return doc._removeRole(userUUID, roleName);
};

// TODO: use store instead of mem
Collection.prototype.find = function ( /* query */ ) {
  var self = this;
  return new Promise(function (resolve) {
    var cursor = new Cursor(self._docs, self),
      //  filter = query && query.where ? where.filter(query.where) : null,
      filter = null,
      filterCursor = new FilterCursor(cursor, filter);
    // if (query && query.order) {
    //   var sort = order.sort(query.order);
    //   resolve(new SortCursor(filterCursor, sort));
    // } else {
    resolve(filterCursor);
    // }
  });
};

// TODO: use store instead of mem
Collection.prototype.get = function (id) {
  return Promise.resolve(this._docs[id]);
};

// TODO: use store instead of mem
Collection.prototype._getDoc = function (id) {
  var doc = this._docs[id];
  return doc;
};

module.exports = Collection;