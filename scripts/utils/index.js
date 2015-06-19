'use strict';

var uuid = require('node-uuid'),
  Promise = require('bluebird'),
  bcrypt = require('bcrypt');

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

Utils.prototype.wrapFunction = function (constr, child, fn) {
  constr.prototype[fn] = function () {
    return this[child][fn].apply(this, arguments);
  };
};

Utils.prototype.wrapFunctions = function (constr, child) {
  for (var fn in constr.prototype) {
    if (typeof constr.prototype[fn] === 'function') {
      this.wrapFunction(constr, child, fn);
    }
  }
};

Utils.prototype.wrapMissing = function (thisArg, obj) {
  for (var k in obj) {
    if (!thisArg[k]) { // missing?
      thisArg[k] = obj[k];
    }
  }
};

Utils.prototype.hash = function (password, salt) {
  var self = this;
  return new Promise(function (resolve, reject) {
    self._bcrypt.hash(password, salt, function (err, hash) {
      if (err) {
        reject(err);
      }
      resolve(hash);
    });
  });
};

Utils.prototype.genSalt = function () {
  var self = this;
  return new Promise(function (resolve, reject) {
    self._bcrypt.genSalt(10, function (err, salt) {
      if (err) {
        reject(err);
      }
      resolve(salt);
    });
  });
};

Utils.prototype.hashPassword = function (password, salt) {
  return this.hash(password, salt).then(function (hash) {
    return {
      salt: salt,
      hash: hash
    };
  });
};

Utils.prototype.genSaltAndHashPassword = function (password) {
  var self = this;
  return self.genSalt(10).then(function (salt) {
    return self.hashPassword(password, salt);
  });
};

Utils.prototype.notDefined = function (val) {
  return typeof val === 'undefined';
};

Utils.prototype.isDefined = function (val) {
  return typeof val !== 'undefined';
};

// Executes promise and then resolves after event emitted once
Utils.prototype.doAndOnce = function (promiseFactory, emitter, evnt) {
  var defer = Promise.defer();

  emitter.once(evnt, function () {
    defer.resolve(arguments);
  });

  return promiseFactory().then(function () {
    return defer.promise;
  });
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

module.exports = new Utils();