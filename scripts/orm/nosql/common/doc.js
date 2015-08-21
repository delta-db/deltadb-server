'use strict';

var utils = require('../../../utils'),
  EventEmitter = require('events').EventEmitter,
  inherits = require('inherits');

var Doc = function (data) {
  this._data = typeof data === 'undefined' ? {} : data;
  this._dirty = {};
};

inherits(Doc, EventEmitter);

Doc.prototype._idName = '$id';

Doc.prototype.id = function (id) {
  if (typeof id === 'undefined') {
    return this.get(this._idName);
  } else {
    this._set(this._idName, id, null, null, true);
  }
};

// Usage: get(name) or get(dirty)
Doc.prototype.get = function (name, dirty) {
  var self = this;
  if (typeof name === 'boolean') {
    dirty = name;
    name = null;
  }
  if (name) {
    return self._data[name];
  } else if (dirty) {
    var doc = {};
    utils.each(self._data, function (value, name) {
      if (self.dirty(name)) {
        doc[name] = value;
      }
    });
    return doc;
  } else {
    return self._data;
  }
};

Doc.prototype.dirty = function (name) {
  if (typeof name === 'undefined') {
    return !utils.empty(this._dirty);
  } else {
    return typeof this._dirty[name] !== 'undefined';
  }
};

Doc.prototype.taint = function (name) {
  this._dirty[name] = true;
};

Doc.prototype.clean = function (name) {
  var self = this;
  if (typeof name === 'undefined') {
    utils.each(self._dirty, function (value, name) {
      self.clean(name);
    });
  } else {
    delete self._dirty[name];
  }
};

Doc.prototype._set = function (name, value, clean) {
  if (!clean && (typeof this._data[name] === 'undefined' || value !== this._data[name])) {
    this.taint(name);
  }
  this._data[name] = value;
};

Doc.prototype.set = function (doc) {
  var self = this;
  utils.each(doc, function (value, name) {
    self._set(name, value);
  });
  return self.save();
};

Doc.prototype.unset = function (name) {
  delete this._data[name];
  return this.save();
};

Doc.prototype._include = function () { // Include in cursor?
  return true;
};

Doc.prototype._register = function () {
  var item = this._collection._getDoc(this.id());
  if (!item) { // doesn't exist? Don't re-register
    return this._collection._register(this);
  }
};

Doc.prototype._unregister = function () {
  return this._collection._unregister(this);
};

Doc.prototype.save = function () {
  // We don't register the item (consider it created) until after it is saved. This way items can be
  // instantiated but not committed to memory
  var self = this;
  return self._item._save.apply(this, arguments).then(function () {
    return self._register();
  });
};

Doc.prototype.destroy = function () {
  var self = this;
  return self._item._destroy.apply(this, arguments).then(function () {
    return self._unregister();
  });
};

module.exports = Doc;