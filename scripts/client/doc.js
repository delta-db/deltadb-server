'use strict';

var inherits = require('inherits'),
  utils = require('../utils'),
  clientUtils = require('./utils'),
  MemDoc = require('../orm/nosql/adapters/mem/doc');

var Doc = function (data, collection, genDocStore) {
  MemDoc.apply(this, arguments); // apply parent constructor
  this._genDocStore = genDocStore; // TODO: is this really needed?
  this._initDat(data);
};

inherits(Doc, MemDoc);

Doc._policyName = '$policy';

Doc._userName = '$user';

Doc._roleName = '$role';

Doc._roleUserName = '$ruser';

Doc.prototype._import = function (store) {
  this._store = store;
  this._initStore();
};

Doc.prototype._pointToData = function () {
  this._data = this._dat.data; // point to wrapped location
};

Doc._createDocStore = function (data, colStore) {
  return colStore.doc(data);
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
  this._dat = this._store.get();

  this._pointToData();
};

Doc.prototype._initStore = function () {
  var self = this;

  return self._opened().then(function () {

    self._loadFromStore();

    self.id(self._store.id());

    // register as doc id was just set
    self._register().then(function () {
      self.emit('load');
    });

  });
};

Doc.prototype._open = function () {
  var self = this;
  return self._collection._opened().then(function () {
    if (self._genDocStore) {
      // Use self._dat as the store needs the reference and not a copy
      self._import(Doc._createDocStore(self._dat, self._collection._store));
    }
  });
};

Doc.prototype._opened = function () {
  if (!this._openPromise) {
    this._openPromise = this._open();
  }
  return this._openPromise;
};

Doc.prototype._saveStore = function () {
  var self = this;
  return self._opened().then(function () {
    // If there is no id, set one so that the id is not set by the store
    var id = self.id();
    if (!id) {
      id = utils.uuid();
      self.id(id);
    }
    self._store.id(id); // use id from data

    return self._store.set(self._dat);
  });
};

Doc.prototype.save = function () {
  var self = this;
  return self._saveStore().then(function () {
    return MemDoc.prototype.save.apply(self, arguments);
  });
};

// TODO: split up
Doc.prototype._change = function (name, value, updated, recorded, untracked) {

  if (!updated) {
    updated = new Date();
  }

  // Determine the event before making any changes to the data and then emit the event after the
  // data has been changed
  var evnts = this._events(name, value, updated);

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

  if (!untracked) { // tracking?
    this._dat.changes.push(change);
  }

  if (name) { // update?
    this._dat.latest[name] = {
      val: value,
      up: updated,
      seq: seq
    };

    if (recorded) {
      this._dat.latest[name].re = recorded;
      this._dat.recordedAt = recorded;
    }

    // update after del?
    if (this._dat.destroyedAt && updated.getTime() > this._dat.destroyedAt.getTime()) {
      this._dat.destroyedAt = null;
    }
  }

  if (evnts.length > 0) {
    this._emitEvents(evnts, name);
  }

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
    this._collection._emit(evnt, this);
  } else {
    var attr = {
      name: name,
      value: value
    };
    this.emit(evnt, attr, this);

    this._collection._emit(evnt, attr, this); // bubble up to collection layer    
  }
};

Doc.prototype._emitDocCreate = function () {
  // Always emit the id as the creating attr
  this._emit('doc:create', this._idName, this.id());
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

      found = true;

      if (name && self._dat.latest[name]) {

        self._emit('attr:record', name, value);
        self._emit('doc:record', name, value);

        self._dat.latest[name].re = recorded;
        self._dat.recordedAt = recorded;
      }

      delete self._dat.changes[i]; // the change was recorded with a quorum of servers so destroy it
    }
  });
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

Doc.prototype._events = function (name, value, updated) {
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

  if (name !== this._idName) { // TODO: do we really not to "track" id changes??
    this._change(name, value, updated, recorded, untracked);
  }

  if (updated && (!this._dat.updatedAt || updated.getTime() > this._dat.updatedAt.getTime())) {
    this._dat.updatedAt = updated;
  }

  return MemDoc.prototype._set.apply(this, arguments);
};

Doc.prototype.unset = function (name, updated, recorded, untracked) {
  if (name !== this._idName) {
    this._change(name, null, updated, recorded, untracked); // TODO: really set value to null?
  }

  return MemDoc.prototype.unset.apply(this, arguments);
};

Doc.prototype.destroy = function (destroyedAt, untracked) {
  // Doesn't actually remove data as we need to preserve tombstone so that we can ignore any
  // outdated changes received for destroyed data
  this._dat.destroyedAt = destroyedAt ? destroyedAt : new Date();
  this._change(null, null, this._dat.destroyedAt, null, untracked);
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

  return self._record(change.name, val, updated, change.seq, recorded);
};

Doc.prototype._setChange = function (change) {
  // TODO: Is this ever needed?
  // if (!this.id()) { // no id?
  // this.id(change.id);
  // }
  return this._saveChange(change);
};

Doc.prototype._include = function () {
  return this._dat.destroyedAt === null;
};

Doc.prototype._setAndSave = function (doc) {
  var self = this;
  return self.set(doc).then(function () {
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

Doc.prototype._addRole = function (userUUID, roleName) {
  var data = {
    action: clientUtils.ACTION_ADD,
    userUUID: userUUID,
    roleName: roleName
  };
  return this._setAndSave(data);
};

Doc.prototype._removeRole = function (userUUID, roleName) {
  var data = {
    action: clientUtils.ACTION_REMOVE,
    userUUID: userUUID,
    roleName: roleName
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
    chng.col = this._collection._name;
    chng.id = this.id();
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