'use strict';

var inherits = require('inherits'),
  utils = require('../utils'),
  clientUtils = require('./utils'),
  MemDoc = require('../orm/nosql/adapters/mem/doc'),
  Promise = require('bluebird');

var Doc = function (data /* , col */ ) {
  MemDoc.apply(this, arguments); // apply parent constructor
  this._initDat(data);

  this._initLoaded();

  this._changeDoc(data);
};

inherits(Doc, MemDoc);

Doc._policyName = '$policy';

Doc._userName = '$user';

Doc._roleName = '$role';

Doc._roleUserName = '$ruser';

Doc.prototype._initLoaded = function () {
  var self = this;
  self._loaded = utils.once(self, 'load');
};

Doc.prototype._import = function (store) {
  this._store = store;
  this._initStore();
};

Doc.prototype._createStore = function () {
  this._import(this._col._store.doc(this._dat));
};

Doc.prototype._pointToData = function () {
  this._data = this._dat.data; // point to wrapped location
};

Doc.prototype._initDat = function (data) {
  // To reduce reads from the store, we will assume that this._dat is always up-to-date and
  // therefore changes can just be committed to the store for persistence
  this._dat = {
    data: data ? data : {},
    changes: [],
    latest: {}, // TODO: best name as pending to be written to server?
    destroyedAt: null, // needed to exclude from cursor before del recorded
    updatedAt: null,
    recordedAt: null // used to determine whether doc has been recorded
  };

  this._pointToData();
};

Doc.prototype._loadFromStore = function () {
  // TODO: use timestamps of existing data to determine whether data from store should replace
  // existing data as the store might load after the data has already been set
  // this._dat = this._store.get();
  this._dat = this._store.getRef(); // actually point to data instead of copy

  this._pointToData();
};

Doc.prototype._initStore = function () {
  var self = this;

  this._loadFromStore();

  if (self._store.id()) { // does the store have an id? e.g. are we reloading data?
    self.id(self._store.id());
    self._register().then(function () {
      self.emit('load');
    });
  } else {
    // We have just created the store and nothing has been saved yet so don't register
    self.emit('load');
  }
};

Doc.prototype._ensureId = function () {
  // If there is no id, set one so that the id is not set by the store
  var id = this.id();
  if (!id) {
    id = utils.uuid();
    this.id(id);
  }
  this._store.id(id); // use id from data
};

Doc.prototype._ensureStore = function () {
  var self = this;
  // Wait until col is loaded and then create store
  return self._col._ensureStore().then(function () {
    self._createStore();
    return self._loaded; // resolves once doc has been loaded
  });
};

Doc.prototype._saveStore = function () {
  var self = this;
  return self._ensureStore().then(function () {
    self._ensureId();
    return self._store.set(self._dat);
  });
};

Doc.prototype.save = function () {
  var self = this;
  return self._saveStore().then(function () {
    return MemDoc.prototype.save.apply(self, arguments);
  });
};

Doc.prototype._emitChange = function () {
  this._col._db.emit('change');
};

// TODO: split up
Doc.prototype._change = function (name, value, updated, recorded, untracked) {

  if (name === this._idName) {
    // Don't track changes to id as the id is sent with every delta already
    return;
  }

  if (!updated) {
    updated = new Date();
  }

  // Determine the event before making any changes to the data and then emit the event after the
  // data has been changed
  var evnts = this._allEvents(name, value, updated);

  // To account for back-to-back writes, increment the seq number if updated is the same
  var seq = this._dat.latest[name] &&
    this._dat.latest[name].up.getTime() === updated.getTime() ? this._dat.latest[name].seq + 1 :
    0;

  var change = {
    up: updated
  };

  if (seq > 0) {
    change.seq = seq;
  }

  if (name) {
    change.name = name;
  }

  if (value) {
    change.val = value;
  }

  // Is the value changing? We also need to consider it changing if there is no latest value as this
  // can happen when auto restoring
  var changing = this._changing(name, value) || !this._dat.latest[name];

  if (!untracked && changing) { // tracking and value changing?
    this._dat.changes.push(change);
    this._emitChange();
  }

  if (name) { // update?
    this._dat.latest[name] = {
      val: value,
      up: updated,
      seq: seq
    };

    if (recorded) {
      this._dat.latest[name].re = recorded; // TODO: is this needed?
      this._dat.recordedAt = recorded;
    }

    // update after del?
    if (this._dat.destroyedAt && updated.getTime() > this._dat.destroyedAt.getTime()) {
      this._dat.destroyedAt = null;
    }
  }

  return evnts.length > 0 ? evnts : null;
};

Doc.prototype._emitEvents = function (evnts, name) {
  var self = this;
  evnts.forEach(function (evnt) {
    self._emit(evnt.evnt, name, evnt.val);
  });
};

Doc.prototype._eventLayer = function (evnt) {
  var parts = evnt.split(':');
  return parts[0];
};

Doc.prototype._emit = function (evnt, name, value) {
  if (this._eventLayer(evnt) === 'doc') {
    this.emit(evnt, this);
    this._col._emit(evnt, this);
  } else {
    var attr = {
      name: name,
      value: value
    };
    this.emit(evnt, attr, this);

    this._col._emit(evnt, attr, this); // bubble up to collection layer
  }
};

Doc.prototype._emitDocCreate = function () {
  // Don't emit if the doc was destroyed
  if (!this._dat.destroyedAt) {
    // Always emit the id as the creating attr
    this._emit('doc:create', this._idName, this.id());
  }
};

Doc.prototype._saveRecording = function (name, value, recorded) {
  if (name && this._dat.latest[name]) {

    this._emit('attr:record', name, value);
    this._emit('doc:record', name, value);

    this._dat.latest[name].re = recorded; // TODO: is this needed?
    this._dat.recordedAt = recorded;
  }
};

// TODO: better "changes" structure needed so that recording can happen faster? Use Dictionary to
// index by docUUID and attrName?
Doc.prototype._record = function (name, value, updated, seq, recorded) {
  var self = this,
    found = false;

  // Use >= as doc deletion takes precedence
  if (!name && (!self._dat.updatedAt || updated.getTime() >= self._dat.updatedAt.getTime())) {
    this._dat.destroyedAt = updated;
  }

  utils.each(self._dat.changes, function (change, i) {
    var val = change.val ? change.val : null;

    var changeSeq = utils.notDefined(change.seq) ? 0 : change.seq;
    seq = utils.notDefined(seq) ? 0 : seq;

    if (change.name === name && val === value && change.up.getTime() === updated.getTime() &&
      changeSeq === seq) {

      found = true; // TODO: stop looping once the change has been found

      self._saveRecording(name, value, recorded);

      // TODO: is it better to use splice here? If so we'd need to iterate through the array
      // backwards so that we process all elements
      delete self._dat.changes[i]; // the change was recorded with a quorum of servers so destroy it
    }
  });

  if (!found) { // change originated from server?
    self._saveRecording(name, value, recorded);
  }
};

Doc.prototype._changeDoc = function (doc) {
  var self = this;
  utils.each(doc, function (value, name) {
    self._change(name, value);
  });
};

Doc.prototype._destroying = function (value) {
  return value ? false : true;
};

// Cannot be called _events as this name is used by EventEmitter
Doc.prototype._allEvents = function (name, value, updated) {
  var evnts = [];

  if (name) { // attr change?
    if (utils.notDefined(this._dat.data[name])) { // attr doesn't exist?
      evnts.push({
        evnt: 'attr:create',
        val: value
      });
    } else if (!this._dat.latest[name] ||
      updated.getTime() > this._dat.latest[name].up.getTime()) { // change most recent?
      if (this._destroying(value)) { // destroying?
        evnts.push({
          evnt: 'attr:destroy',
          val: this._dat.latest[name].val
        });
      } else { // updating
        evnts.push({
          evnt: 'attr:update',
          val: value
        });
      }
    }
    evnts.push({
      evnt: 'doc:update',
      val: value
    });
  } else { // destroying doc?
    if (!this._dat.updatedAt || updated.getTime() > this._dat.updatedAt.getTime()) { // most recent?
      evnts.push({
        evnt: 'doc:destroy',
        val: value
      });
    }
  }
  return evnts;
};

Doc.prototype._set = function (name, value, updated, recorded, untracked) {

  var events = this._change(name, value, updated, recorded, untracked);

  if (updated && (!this._dat.updatedAt || updated.getTime() > this._dat.updatedAt.getTime())) {
    this._dat.updatedAt = updated;
  }

  // Set the value before any events are emitted by _change()
  var ret = MemDoc.prototype._set.apply(this, arguments);

  if (events) {
    this._emitEvents(events, name);
  }

  return ret;
};

Doc.prototype.unset = function (name, updated, recorded, untracked) {
  // TODO: really set value to null?
  var events = this._change(name, null, updated, recorded, untracked);

  // Unset the value before any events are emitted by _change()
  var ret = MemDoc.prototype.unset.apply(this, arguments);

  if (events) {
    this._emitEvents(events, name);
  }

  return ret;
};

// TODO: remove this after enhance id-less docs to reconcile with ids?
Doc.prototype._destroyLocally = function () {
  var self = this;
  return MemDoc.prototype.destroy.apply(this, arguments).then(function () {
    return self._store.destroy();
  });
};

Doc.prototype.destroy = function (destroyedAt, untracked) {
  // Doesn't actually remove data as we need to preserve tombstone so that we can ignore any
  // outdated changes received for destroyed data
  this._dat.destroyedAt = destroyedAt ? destroyedAt : new Date();

  var events = this._change(null, null, this._dat.destroyedAt, null, untracked);

  if (events) {
    this._emitEvents(events, null);
  }

  return this.save();
};

Doc.prototype._saveChange = function (change) {
  var updated = new Date(change.up); // date is string
  var recorded = change.re ? new Date(change.re) : null; // date is string
  var val = change.val ? JSON.parse(change.val) : null; // val is JSON
  var latest = this._dat.latest[change.name];
  var self = this;

  this._markedAt = null;
  if (latest) {
    delete latest.markedAt;
  }

  // TODO: why is getTime() needed?
  if (change.name) { // changing attr
    if ((!latest || updated.getTime() > latest.up.getTime() ||
        (updated.getTime() === latest.up.getTime() && change.seq > latest.seq) ||
        (updated.getTime() === latest.up.getTime() &&
          change.seq === latest.seq /* && val > latest.val */ ))) {
      if (change.val) {
        self._set(change.name, val, updated, recorded, true);
      } else {
        self.unset(change.name, updated, recorded, true);
      }
      return self.save().then(function () {
        self._record(change.name, val, updated, change.seq, recorded);
      });
    }
  } else if (!this._dat.updatedAt ||
    updated.getTime() > this._dat.updatedAt.getTime()) { // destroying doc?
    return self.destroy(updated, true).then(function () {
      self._record(change.name, val, updated, change.seq, recorded);
    }); // don't track as coming from server
  }

  return Promise.resolve().then(function () {
    self._record(change.name, val, updated, change.seq, recorded);
  });
};

Doc.prototype._setChange = function (change) {
  var self = this;
  return self._saveChange(change).then(function () {
    // Commit the changes to the store so that they aren't lost
    return self._saveStore();
  });
};

Doc.prototype._include = function () {
  return this._dat.destroyedAt === null;
};

Doc.prototype._setAndSave = function (doc) {
  var self = this;
  return self.set(doc).then(function () {
    // TODO: is the following line needed? Isn't it called by set?
    return self.save();
  }).then(function () {
    return self;
  });
};

Doc.prototype.policy = function (policy) {
  var doc = {};
  doc[Doc._policyName] = policy;
  return this._setAndSave(doc);
};

// Shouldn't be called directly as the docUUID needs to be set properly
Doc.prototype._createUser = function (userUUID, username, password, status) {
  var self = this,
    doc = {};
  return clientUtils.genUser(userUUID, username, password, status).then(function (user) {
    doc[Doc._userName] = user;
    return self._setAndSave(doc);
  });
};

// TODO: is this really working? Doesn't the attr name need to be set?
Doc.prototype._addRole = function (userUUID, roleName) {
  var data = {
    action: clientUtils.ACTION_ADD,
    userUUID: userUUID,
    roleName: roleName
  };
  return this._setAndSave(data);
};

// TODO: is this really working? Doesn't the attr name need to be set?
Doc.prototype._removeRole = function (userUUID, roleName) {
  var data = {
    action: clientUtils.ACTION_REMOVE,
    userUUID: userUUID,
    roleName: roleName
  };
  return this._setAndSave(data);
};

// Note: must only be called for System DB
Doc.prototype._createDatabase = function (dbName) {
  var data = {};
  data[clientUtils.DB_ATTR_NAME] = {
    action: clientUtils.ACTION_ADD,
    name: dbName
  };
  return this._setAndSave(data);
};

// Note: must only be called for System DB
Doc.prototype._destroyDatabase = function (dbName) {
  var data = {};
  data[clientUtils.DB_ATTR_NAME] = {
    action: clientUtils.ACTION_REMOVE,
    name: dbName
  };
  return this._setAndSave(data);
};

Doc.prototype._formatChange = function (retryAfter, returnSent, changes, change, now) {
  // Use >= to ensure we get all changes when retryAfter=0
  if (!change.sent || now >= change.sent.getTime() + retryAfter) { // never sent or retry?
    var chng = utils.clone(change); // clone so that we don't modify original data
    if (!returnSent) {
      delete chng.sent; // server doesn't need sent
    }
    chng.col = this._col._name;
    chng.id = this.id();
    chng.up = change.up.toISOString();
    if (chng.val) { // don't set val if falsy
      chng.val = JSON.stringify(chng.val);
    }
    // if (!change.seq) {
    //   delete chng.seq; // save some bandwidth and clear the seq if 0
    // }
    changes.push(chng);
    change.sent = new Date();
  }
};

Doc.prototype._localChanges = function (retryAfter, returnSent) {
  var self = this,
    changes = [],
    now = (new Date()).getTime();
  retryAfter = typeof retryAfter === 'undefined' ? 0 : retryAfter;
  utils.each(this._dat.changes, function (change) {
    self._formatChange(retryAfter, returnSent, changes, change, now);
  });
  return changes;
};

module.exports = Doc;
