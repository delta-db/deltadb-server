'use strict';

var utils = require('./index');

// We need an obj to help us determine which data is a value and which is a holder of keys
var Items = function () {};

var NILL = '$$null$$'; // so that we can hash null keys

var Dictionary = function () {
  this._items = new Items();
};

Dictionary.prototype._firstKey = function (items) {
  for (var i in items) {
    return i;
  }
};

Dictionary.prototype._first = function (items) {
  for (var i in items) {
    return items[i];
  }
};

Dictionary.prototype._hash = function (k) {
  return k === null ? NILL : k;
};

Dictionary.prototype._unhash = function (k) {
  return k === NILL ? null : k;
};

Dictionary.prototype._set = function (items, keysAndValue) {
  var i = this._firstKey(keysAndValue);
  var k = this._hash(keysAndValue[i]);
  delete keysAndValue[i];
  if (keysAndValue.length === 2) { // e.g. _set(items, ['x', 1])
    items[k] = this._first(keysAndValue);
  } else {
    if (!items[k]) {
      items[k] = new Items();
    }
    keysAndValue.length--; // arguments is not an array
    this._set(items[k], keysAndValue);
  }
};

Dictionary.prototype.set = function () {
  if (arguments.length <= 2) {
    throw new Error('usage: set(key1, [key2, ... keyN], value)');
  }
  this._set(this._items, arguments);
};

Dictionary.prototype._get = function (items, keys, destroy) {
  var i = this._firstKey(keys);
  var k = this._hash(keys[i]);
  if (!items[k]) {
    throw new Error(k + ' missing');
  }
  if (keys.length === 1) { // e.g. _get(items, ['x'])
    var val = items[k];
    if (destroy) {
      delete items[k];
    }
    return val;
  } else {
    delete keys[i];
    keys.length--; // arguments is not an array
    return this._get(items[k], keys, destroy);
  }
};

Dictionary.prototype.get = function () {
  return this._get(this._items, arguments);
};

Dictionary.prototype.exists = function () {
  try {
    this._get(this._items, arguments);
  } catch (err) {
    return false;
  }
  return true;
};

// TODO: rename destroy to unset
Dictionary.prototype.destroy = function () {
  return this._get(this._items, arguments, true);
};

Dictionary.prototype._each = function (items, keys, callback) {
  var self = this;
  if (!Items.prototype.isPrototypeOf(items)) { // value?
    callback(items, keys);
  } else {
    utils.each(items, function (item, key) {
      var curKeys = utils.clone(keys);
      curKeys.push(self._unhash(key));
      self._each(item, curKeys, callback);
    });
  }
};

Dictionary.prototype.each = function (callback) {
  return this._each(this._items, [], callback);
};

module.exports = Dictionary;
