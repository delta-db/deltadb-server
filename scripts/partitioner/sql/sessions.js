/*

// SAVE FOR FUTURE: Some of this code has been tested, but a lot has not. I'm not sure that sessions
// are needed for the 1st phase of DeltaDB. Instead, we'll just expect the connecting user to pass
// the username and password in the RESTful API call. Use of sessions and tokens is probably
// something that will be useful later when integrations are performed with other authentication
// systems like oauth.

// IDEA: the client authenticates by creating a session and then uses a token for all requests. At
// this point, sessions don't have a UUID so they need to be created on each database when the user
// first authenticates with that database. Either this, or we could develop a session UUID and pass
// them through the changes feed.


'use strict';

// TODO: create a cleanup routine that calls destroyExpired()

// TODO: separate into session-recs and session

var CryptoJS = require("crypto-js"),
  Promise = require('bluebird'),
  constants = require('./constants'),
  TokenError = require('./token-error'),
  MissingError = require('../../orm/sql/common/missing-error'),
  SQLError = require('../../orm/sql/common/sql-error'),
  SessionExpiredError = require('./session-expired-error');

var Sessions = function (sql, users) {
  this._sql = sql;
  this._users = users;
};

Sessions.NAME = 'sessions';
Sessions.ID_LAST_RESERVED = constants.ID_LAST_RESERVED;

// TODO: how best to make this configurable?
Sessions.EXP_AFTER_MSECS = 3600000;

Sessions.prototype.createTable = function () {

  var self = this;

  var schema = {
    id: {
      type: 'primary'
    },
    user_id: {
      type: 'key',
      null: false
    },
    token: {
      type: 'varbinary',
      length: 44,
      null: false,
      unique: true
    },
    expires_at: {
      type: 'datetime'
    },
    created_at: {
      type: 'datetime',
      default: 'currenttimestamp',
      null: false
    },
    updated_at: {
      type: 'datetime',
      default: 'currenttimestamp',
      null: false
    }
  };

  return self._sql.createTable(Sessions.NAME, schema, null, Sessions.ID_LAST_RESERVED);

};

Sessions.prototype.truncateTable = function () {
  return this._sql.truncateTable(Sessions.NAME, 'id', Sessions.ID_LAST_RESERVED);
};

Sessions.prototype._genToken = function () {
  var hash = CryptoJS.HmacSHA256(Math.random(), Math.random() + '');
  var hashInBase64 = CryptoJS.enc.Base64.stringify(hash);
  return hashInBase64;
};

Sessions.prototype._createRecord = function (userId, token) {
  return this._sql.insert({
    user_id: userId,
    token: token,
    expires_at: new Date((new Date()).getTime() + Sessions.EXP_AFTER_MSECS)
  }, Sessions.NAME, 'id').then(function () {
    return token;
  });
};

Sessions.MAX_TOKEN_ATTEMPTS = 10;

Sessions.prototype._attemptToCreate = function (userId, attempt) {
  var self = this;
  return Promise.resolve().then(function () {
    if (attempt >= Sessions.MAX_TOKEN_ATTEMPTS) {
      throw new TokenError('failed to create token after ' + attempt + ' attempts');
    }

    return self._createRecord(userId, self._genToken()).catch(function (err) {
      if (!(err instanceof SQLError)) {
        throw err;
      }
      // Allow SQL errors caused by a duplicate token
      return self._attemptToCreate(userId, attempt + 1);
    });
  });
};

Sessions.prototype._create = function (userId) {
  // It is possible, yet rare that the token is already taken and in this case we will retry until
  // we no longer have a collision
  return this._attemptToCreate(userId, 0);
};

// TODO: is there a way for the client not to send the password as cleartext without first getting
// the salt for the user? Could do this by deciding on a global salt and then hashing the password
// twice, once by the client and another time by the server before storage, but is this really worth
// it? It would prevent the password from being cleartext in a JS console.
Sessions.prototype.authenticate = function (username, password) {
  var self = this;
  return self._users.authenticated(username, password).then(function (userId) {
    return self._create(userId);
  });
};

Sessions.prototype._find = function (token) {
  return this._sql.findAndThrowIfMissing(null, Sessions.NAME, null, ['token', '=', '"' + token +
    '"'
  ]);
};

Sessions.prototype.authenticated = function (token) {
  // Check token and exp date, if ok then return userId. If session expired then destroy session
  var self = this;
  return self._find(token).then(function (results) {
    var expiresAt = results.rows[0].expires_at;
    if (expiresAt.getTime() >= (new Date()).getTime()) { // expired?
      return self._destroy(token).then(function () {
        throw new SessionExpiredError('session expired at ' + expiresAt.toUTCString());
      });
    }
    return results.rows[0].user_id;
  });
};

Sessions.prototype.refresh = function (token) {
  return this._sql.update({
    updated_at: new Date()
  }, Sessions.NAME, ['token', '=', '"' + token + '"']);
};

Sessions.prototype._destroy = function (token) {
  // Make sure another thread didn't just refresh the session by qualifying with timestamp
  var now = (new Date()).toUTCString(); // TODO: can this be automatically handled by ORM?
  return this._sql.destroy(Sessions.NAME, [
    ['token', '=', '"' + token + '"'], 'and', ['expires_at', '>=', '"' + now + '"']
  ]);
};

Sessions.prototype.destroyExpired = function () {
  var now = (new Date()).toUTCString(); // TODO: can this be automatically handled by ORM?
  return this._sql.destroy(Sessions.NAME, ['expires_at', '>=', '"' + now + '"']);
};

module.exports = Sessions;

*/
