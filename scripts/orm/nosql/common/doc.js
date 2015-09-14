'use strict';

var utils = require('../../../utils'),
  EventEmitter = require('events').EventEmitter,
  inherits = require('inherits'),
  Promise = require('bluebird');

var Doc = function (data, collection) {
  this._data = data ? data : {};
  this._collection = collection;
  this._dirty = {};
};

inherits(Doc, EventEmitter);

Doc._idName = '$id';
Doc.prototype._idName = '$id'; // Move to DB layer?

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

Doc.prototype.set = function (data) {
  var self = this;
  utils.each(data, function (value, name) {
    self._set(name, value);
  });
  return self.save();
};

// TODO: remove
// Doc.prototype.unset = function (name) {
//   delete this._data[name];
//   return this.save();
// };

// TODO: remove
// Doc.prototype._include = function () { // Include in cursor?
//   return true;
// };

Doc.prototype._register = function () {
  var self = this;
  return this._collection.get(this.id()).then(function (/* doc */) {
    // if (!doc) { // doesn't exist? Don't re-register // TODO: remove?
    return self._collection._register(self);
    // }
  });
};

Doc.prototype._unregister = function () {
  return this._collection._unregister(this);
};

Doc.prototype.save = function () {
  // We don't register the doc (consider it created) until after it is saved. This way docs can be
  // instantiated but not committed to memory
  var self = this;
  return self._save.apply(self, arguments).then(function () {
    return self._register();
  });
};

Doc.prototype._insert = function () {
  // if (!this.id()) { // id missing? Then generate // TODO: remove?
  this.id(utils.uuid());
  // }
  return Promise.resolve();
};

Doc.prototype._update = utils.resolveFactory();

Doc.prototype._save = function () {
  var self = this,
    promise = self.id() ? self._update() : self._insert();
  return promise.then(function () {
    self.clean();
  });
};

Doc.prototype.destroy = function () {
  var self = this;
  return self._destroy.apply(self, arguments).then(function () {
    return self._unregister();
  });
};

Doc.prototype._destroy = utils.resolveFactory();

module.exports = Doc;