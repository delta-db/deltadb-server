'use strict';

var utils = require('deltadb-common-utils'),
  EventEmitter = require('events').EventEmitter,
  inherits = require('inherits'),
  Promise = require('bluebird');

var Doc = function (data, col) {
  EventEmitter.apply(this, arguments); // apply parent constructor
  this._data = data ? data : {};

  if (!this._data[Doc._idName]) { // no id?
    this._data[Doc._idName] = utils.uuid(); // generate id
  }

  this._col = col;
  this._dirty = {};
};

inherits(Doc, EventEmitter);

Doc._idName = '$id';
Doc.prototype._idName = '$id'; // Move to DB layer?

Doc.prototype.id = function () {
  return this.get(this._idName);
};

Doc.prototype.getRef = function () {
  return this._data;
};

// Usage: get(name) or get(dirty)
Doc.prototype.get = function (name, dirty) {
  var self = this;

  // Copy the data so that caller cannot modify our internal representation accidentially
  var data = utils.clone(self._data);

  if (typeof name === 'boolean') {
    dirty = name;
    name = null;
  }

  if (name) {
    return data[name];
  } else if (dirty) {
    var doc = {};
    utils.each(data, function (value, name) {
      if (self.dirty(name)) {
        doc[name] = value;
      }
    });
    return doc;
  } else {
    return data;
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

Doc.prototype._changing = function (name, value) {
  return typeof this._data[name] === 'undefined' || value !== this._data[name];
};

Doc.prototype._set = function (name, value, clean) {
  if (!clean && this._changing(name, value)) {
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

Doc.prototype.unset = function (name) {
  delete this._data[name];
  return this.save();
};

Doc.prototype._include = function () { // Include in cursor?
  return true;
};

Doc.prototype._unregister = function () {
  return this._col._unregister(this);
};

Doc.prototype.save = function () {
  return this._save();
};

Doc.prototype._insert = function () {
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
