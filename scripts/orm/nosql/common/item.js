'use strict';

var utils = require('../../../utils'),
  EventEmitter = require('events').EventEmitter,
  inherits = require('inherits');

var Item = function (doc) {
  this._doc = typeof doc === 'undefined' ? {} : doc;
  this._dirty = {};
};

inherits(Item, EventEmitter);

Item.prototype._idName = '$id';

Item.prototype.id = function (id) {
  if (typeof id === 'undefined') {
    return this.get(this._idName);
  } else {
    this._set(this._idName, id, null, null, true);
  }
};

// Usage: get(name) or get(dirty)
Item.prototype.get = function (name, dirty) {
  var self = this;
  if (typeof name === 'boolean') {
    dirty = name;
    name = null;
  }
  if (name) {
    return self._doc[name];
  } else if (dirty) {
    var doc = {};
    utils.each(self._doc, function (value, name) {
      if (self.dirty(name)) {
        doc[name] = value;
      }
    });
    return doc;
  } else {
    return self._doc;
  }
};

Item.prototype.dirty = function (name) {
  if (typeof name === 'undefined') {
    return !utils.empty(this._dirty);
  } else {
    return typeof this._dirty[name] !== 'undefined';
  }
};

Item.prototype.taint = function (name) {
  this._dirty[name] = true;
};

Item.prototype.clean = function (name) {
  var self = this;
  if (typeof name === 'undefined') {
    utils.each(self._dirty, function (value, name) {
      self.clean(name);
    });
  } else {
    delete self._dirty[name];
  }
};

Item.prototype._set = function (name, value, clean) {
  if (!clean && (typeof this._doc[name] === 'undefined' || value !== this._doc[name])) {
    this.taint(name);
  }
  this._doc[name] = value;
};

Item.prototype.set = function (doc) {
  var self = this;
  utils.each(doc, function (value, name) {
    self._set(name, value);
  });
  return self.save();
};

Item.prototype.unset = function (name) {
  delete this._doc[name];
  return this.save();
};

Item.prototype._include = function () { // Include in cursor?
  return true;
};

Item.prototype._register = function () {
  var item = this._collection._getItem(this.id());
  if (!item) { // doesn't exist? Don't re-register
    return this._collection._register(this);
  }
};

Item.prototype._unregister = function () {
  return this._collection._unregister(this);
};

Item.prototype.save = function () {
  // We don't register the item (consider it created) until after it is saved. This way items can be
  // instantiated but not committed to memory
  var self = this;
  return self._item._save.apply(this, arguments).then(function () {
    return self._register();
  });
};

Item.prototype.destroy = function () {
  var self = this;
  return self._item._destroy.apply(this, arguments).then(function () {
    return self._unregister();
  });
};

module.exports = Item;