'use strict';

// TODO: move any code needed by the client to client/utils.js

// TODO: split into utils for deltadb, deltadb-nosql-orm, deltadb-sql-orm, deltadb-server. Also need
// a deltadb-common for things like common test utils?

var uuid = require('node-uuid'),
  Promise = require('bluebird'),
  // bcrypt = require('bcrypt'); // TODO: use for server as faster?
  bcrypt = require('bcryptjs'),
  clientUtils = require('../client/utils');

var Utils = function () {
  this._bcrypt = bcrypt; // only for unit testing
};

Utils.prototype.clone = function (obj) {
  return JSON.parse(JSON.stringify(obj));
};

// callback = function (item, key, obj)
// Note: if callback returns false then the loop will stop
Utils.prototype.each = function (obj, callback) {
  for (var i in obj) {
    /* istanbul ignore next */
    if (obj.hasOwnProperty(i)) {
      if (callback(obj[i], i, obj) === false) {
        break;
      }
    }
  }
};

Utils.prototype.keys = function (obj) {
  var keys = [];
  this.each(obj, function (value, key) {
    keys.push(key);
  });
  return keys;
};

Utils.prototype.empty = function (obj) {
  var empty = true;
  this.each(obj, function () {
    empty = false;
    return false; // stop loop
  });
  return empty;
};

Utils.prototype.uuid = function () {
  return uuid.v4();
};

Utils.prototype.resolveFactory = function (data) {
  return function () {
    return Promise.resolve(data);
  };
};

Utils.prototype.promiseError = function (err) {
  return new Promise(function () {
    throw err;
  });
};

Utils.prototype.promiseErrorFactory = function (err) {
  var self = this;
  return function () {
    return self.promiseError(err);
  };
};

Utils.prototype.merge = function (obj1, obj2) {
  var merged = {},
    i;
  if (obj1) {
    for (i in obj1) {
      merged[i] = obj1[i];
    }
  }
  if (obj2) {
    for (i in obj2) {
      merged[i] = obj2[i];
    }
  }
  return merged;
};

Utils.prototype.hash = function (password, salt) {
  // TODO: change all callers to use utils
  return clientUtils.hash.apply(this, arguments);
};

Utils.prototype.genSalt = function () {
  // TODO: change all callers to use utils
  return clientUtils.genSalt.apply(this, arguments);
};

Utils.prototype.hashPassword = function (password, salt) {
  // TODO: change all callers to use utils
  return clientUtils.hashPassword.apply(this, arguments);
};

Utils.prototype.genSaltAndHashPassword = function (password) {
  // TODO: change all callers to use utils
  return clientUtils.genSaltAndHashPassword.apply(this, arguments);
};

Utils.prototype.notDefined = function (val) {
  return typeof val === 'undefined';
};

Utils.prototype.isDefined = function (val) {
  return typeof val !== 'undefined';
};

// Executes promise and then resolves after event emitted once
Utils.prototype.doAndOnce = function () {
  // TODO: change all callers to use utils
  return clientUtils.doAndOnce.apply(this, arguments);
};

Utils.prototype.once = function () {
  // TODO: change all callers to use utils
  return clientUtils.once.apply(this, arguments);
};

Utils.prototype.sort = function (items, attrs) {
  items.sort(function (a, b) {
    var ret = 0;
    attrs.forEach(function (attr) {
      if (ret === 0) {
        if (!a[attr] && !b[attr]) {
          ret = 0;
        } else if (!a[attr] && b[attr]) {
          ret = 1;
        } else if (a[attr] && !b[attr]) {
          ret = -1;
        } else if (a[attr] < b[attr]) {
          ret = -1;
        } else if (a[attr] > b[attr]) {
          ret = 1;
        }
      }
    });
    return ret;
  });
  return items;
};

Utils.prototype.toArgsArray = function (argsObj) {
  return Array.prototype.slice.call(argsObj);
};

Utils.prototype.promisify = function (fn, thisArg) {
  var self = this;
  return function () {
    var argsArray = self.toArgsArray(arguments);
    return new Promise(function (resolve, reject) {

      // Define a callback and add it to the arguments
      var callback = function (err) {
        if (err) {
          reject(err);
        } else if (arguments.length === 2) { // single param?
          resolve(arguments[1]);
        } else { // multiple params?
          var cbArgsArray = self.toArgsArray(arguments);
          resolve(cbArgsArray.slice(1)); // remove err arg
        }
      };

      argsArray.push(callback);
      fn.apply(thisArg, argsArray);
    });
  };
};

module.exports = new Utils();
