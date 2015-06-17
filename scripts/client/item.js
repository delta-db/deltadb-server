'use strict';

var inherits = require('inherits'),
  utils = require('../utils'),
  ItemWrapper = require('../orm/nosql/wrapper/item');

var Item = function (item) {
  ItemWrapper.apply(this, arguments); // apply parent constructor
  this._changes = [];
  this._latest = {}; // TODO: best name as pending to be written to server?
  this._destroyedAt = null; // needed to exclude from cursor before del recorded
  this._updatedAt = null;
  this._recordedAt = null; // used to determine whether doc has been recorded
  this._changeDoc(item.get());
};

inherits(Item, ItemWrapper);

Item._policyName = '$policy';

Item._userName = '$user';

Item._roleName = '$role';

Item._roleUserName = '$ruser';

// TODO: split up
Item.prototype._change = function (name, value, updated, recorded, untracked) {

  if (!updated) {
    updated = new Date();
  }

  // Determine the event before making any changes to the data and then emit the event after the
  // data has been changed
  var evnts = this._events(name, value, updated);

  // To account for back-to-back writes, increment the seq number if updated is the same
  var seq = this._latest[name] &&
    this._latest[name].up.getTime() === updated.getTime() ? this._latest[name].seq + 1 : 0;

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
    this._changes.push(change);
  }

  if (name) { // update?
    this._latest[name] = {
      val: value,
      up: updated,
      seq: seq
    };

    if (recorded) {
      this._latest[name].re = recorded;
      this._recordedAt = recorded;
    }

    if (this._destroyedAt && updated.getTime() > this._destroyedAt.getTime()) { // update after del?
      this._destroyedAt = null;
    }
  }

  if (evnts.length > 0) {
    this._emitEvents(evnts, name);
  }

};

Item.prototype._emitEvents = function (evnts, name) {
  var self = this;
  evnts.forEach(function (evnt) {
    self._emit(evnt.evnt, name, evnt.val);
  });
};

Item.prototype._emit = function (evnt, name, value) {
  var attr = {
    name: name,
    value: value
  };
  this.emit(evnt, attr, this);

  this._collection._emit(evnt, attr, this); // bubble up to collection layer
};

Item.prototype._emitDocCreate = function () {
  // Always emit the id as the creating attr
  this._emit('doc:create', this._idName, this.id());
};

// TODO: better "changes" structure needed so that recording can happen faster? Use Dictionary to
// index by docUUID and attrName?
Item.prototype._record = function (name, value, updated, seq, recorded) {
  var self = this,
    found = false;

  // Use >= as doc deletion takes precedence
  if (!name && (!self._updatedAt || updated.getTime() >= self._updatedAt.getTime())) {
    this._destroyedAt = updated;
  }

  utils.each(self._changes, function (change, i) {
    var val = change.val ? change.val : null;

    var changeSeq = utils.notDefined(change.seq) ? 0 : change.seq;
    seq = utils.notDefined(seq) ? 0 : seq;

    if (change.name === name && val === value && change.up.getTime() === updated.getTime() &&
      changeSeq === seq) {

      found = true;

      if (name && self._latest[name]) {

        self._emit('attr:record', name, value);
        self._emit('doc:record', name, value);

        self._latest[name].re = recorded;
        self._recordedAt = recorded;
      }

      delete self._changes[i]; // the change was recorded with a quorum of servers so destroy it
    }
  });
};

Item.prototype._changeDoc = function (doc) {
  var self = this;
  utils.each(doc, function (value, name) {
    self._change(name, value);
  });
};

Item.prototype._destroying = function (value) {
  return value ? false : true;
};

Item.prototype._events = function (name, value, updated) {
  var evnts = [];

  if (name) { // attr change?
    if (utils.notDefined(this._doc[name])) { // attr doesn't exist?
      evnts.push({
        evnt: 'attr:create',
        val: value
      });
    } else if (!this._latest[name] ||
      updated.getTime() > this._latest[name].up.getTime()) { // change most recent?
      if (this._destroying(value)) { // destroying?
        evnts.push({
          evnt: 'attr:destroy',
          val: this._latest[name].val
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
    if (!this._updatedAt || updated.getTime() > this._updatedAt.getTime()) { // most recent?
      evnts.push({
        evnt: 'doc:destroy',
        val: value
      });
    }
  }
  return evnts;
};

Item.prototype._set = function (name, value, updated, recorded, untracked) {

  if (name !== this._idName) { // TODO: do we really not to "track" id changes??
    this._change(name, value, updated, recorded, untracked);
  }

  if (updated && (!this._updatedAt || updated.getTime() > this._updatedAt.getTime())) {
    this._updatedAt = updated;
  }

  return this._item._set.apply(this, arguments);
};

Item.prototype.unset = function (name, updated, recorded, untracked) {
  if (name !== this._idName) {
    this._change(name, null, updated, recorded, untracked); // TODO: really set value to null?
  }
  return this._item.unset.apply(this, arguments);
};

Item.prototype.destroy = function (destroyedAt, untracked) {
  // Doesn't actually remove data as we need to preserve tombstone so that we can ignore any
  // outdated changes received for destroyed data
  this._destroyedAt = destroyedAt ? destroyedAt : new Date();
  this._change(null, null, this._destroyedAt, null, untracked);
  return this.save();
};

Item.prototype._saveChange = function (change) {
  var updated = new Date(change.up); // date is string
  var recorded = change.re ? new Date(change.re) : null; // date is string
  var val = change.val ? JSON.parse(change.val) : null; // val is JSON
  var latest = this._latest[change.name];
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
  } else if (!this._updatedAt || updated.getTime() > this._updatedAt.getTime()) { // destroying doc?
    return self.destroy(updated, true).then(function () {
      self._record(change.name, val, updated, change.seq, recorded);
    }); // don't track as coming from server
  }

  return self._record(change.name, val, updated, change.seq, recorded);
};

Item.prototype._setChange = function (change) {
  // TODO: Is this ever needed?
  // if (!this.id()) { // no id?
  // this.id(change.id);
  // }
  return this._saveChange(change);
};

Item.prototype._include = function () {
  return this._destroyedAt === null;
};

module.exports = Item;