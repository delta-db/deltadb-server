'use strict';

// TODO: move all code needed by client from ../utils to client/utils

var utils = require('../utils');

var Utils = function () {};

Utils.prototype.STATUS_ENABLED = 'enabled'; // Also set here so that client doesn't need Users

Utils.prototype.genUser = function (userUUID, username, password, status) {
  // Include uuid in user so that can retrieve userUUIDs using deltas
  var user = {
    uuid: userUUID,
    username: username,
    status: status ? status : this.STATUS_ENABLED
  };
  return utils.genSaltAndHashPassword(password).then(function (saltAndPwd) {
    user.salt = saltAndPwd.salt;
    user.password = saltAndPwd.hash;
    return user;
  });
};

// Use a prefix so that user UUIDs don't conflict with UUIDs of other docs
Utils.prototype.UUID_PRE = '$u';

Utils.prototype.toDocUUID = function (userUUID) {
  // docUUID is derived from userUUID as we need to create user's dynamically when we first
  // encounter a change and need a way to reference that user later
  return this.UUID_PRE + userUUID;
};

Utils.prototype.NAME_PRE_USER_ROLES = '$ur';

Utils.prototype.ACTION_ADD = 'add';
Utils.prototype.ACTION_REMOVE = 'remove';

Utils.prototype.SYSTEM_DB_NAME = '$system';
Utils.prototype.DB_COLLECTION_NAME = '$db';
Utils.prototype.DB_ATTR_NAME = '$db';

module.exports = new Utils();