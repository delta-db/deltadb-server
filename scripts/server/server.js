'use strict';

// TODO: Need a connection per DB? Seems wasteful, but DB may not exist yet and may need to interact
// w/ System DB to create another DB. Advantage to having separate connections is that you can
// prioritize a DB over another! If multiple DBs per socket then how to handle connections with diff
// servers if DBs on diff servers? Chosing socket per DB for now.

var http = require('http'),
  https = require('https'),
  fs = require('fs'),
  socketio = require('socket.io'),
  Partitioners = require('./partitioners'),
  log = require('../server/log'),
  config = require('../../config'),
  commonUtils = require('deltadb-common-utils'),
  Promise = require('bluebird');

var Server = function (process) {
  this._partitioners = new Partitioners();
  this._process = process;
};

Server.prototype._emitInitDone = function (socket) {
  // TODO: we currently expect the client to hold off on sending us changes until we have
  // emitted init-done as we need to make sure that our partitioner is ready. We could some
  // internal pub/sub on the server to register for 'changes' before the partitioner is ready
  // and then handle the changes when the partitioner becomes ready. However, is it best for
  // future expansion to keep the init/init-done handshaking?
  log.info('sending (to ' + socket.conn.id + ') init-done');
  socket.emit('init-done');
};

Server.prototype._findAndEmitChanges = function (socket, partitioner) {
  // The server just connected so send the latest changes to the client
  this._partitioners.findAndEmitChanges(partitioner._dbName, socket);
};

Server.prototype._since = function (msg) {
  return msg.since ? new Date(msg.since) : null;
};

Server.prototype._registerInitListener = function (socket) {
  var self = this;
  socket.on('init', function (msg) {
    var clonedMsg = commonUtils.clone(msg);
    clonedMsg.password = '[hidden from log]';
    clonedMsg.hashed = '[hidden from log]';
    log.info('received (from ' + socket.conn.id + ') init:' + JSON.stringify(clonedMsg));
    // TODO: error checking if msg not in correct format

    // Lookup/create partitioner for DB name
    var since = self._since(msg);

    var promise = null;
    if (msg.username) { // authenticate?
      promise = self._process.authenticated(msg.db, msg.username, msg.password, msg.hashed);
    } else {
      promise = Promise.resolve();
    }

    return promise.then(function (user) {
      var uuid = user ? user.uuid : null;
      var id = user ? user.id : null;
      return self._partitioners.existsThenRegister(msg.db, socket, since, msg.filter,
        uuid, id);
    }).then(function (partitioner) {
      self._registerDisconnectListener(socket, partitioner);
      self._registerChangesListener(socket, partitioner);
      self._emitInitDone(socket);
      self._findAndEmitChanges(socket, partitioner);
    }).catch(function (err) {
      log.warning('err=' + err.message);
      socket.emit('delta-error', err); // Cannot use 'error' as it interferes with socket.io
    });
  });
};

Server.prototype._unregister = function (dbName, socket) {
  return this._partitioners.unregister(dbName, socket).catch(function (err) {
    log.warning('unregister error=' + err);
  });
};

Server.prototype._onDisconnectFactory = function (socket, partitioner) {
  var self = this;
  return function () {
    log.info(socket.conn.id + ' disconnected');
    return self._unregister(partitioner._dbName, socket);
  };
};

Server.prototype._registerDisconnectListener = function (socket, partitioner) {
  // TODO: should disconnect really be the same as end? In my quick tests, it looks like you get a
  // new socket when you reconnect (based on conn.id) so yes. Do more research.
  socket.on('disconnect', this._onDisconnectFactory(socket, partitioner));
};

Server.prototype._queueChanges = function (dbName, socket, msg) {
  this._partitioners._queueChanges(dbName, socket, msg).catch(function (err) {
    log.warning('changes error=' + err);
  });
};

Server.prototype._onChangesFactory = function (socket, partitioner) {
  var self = this;
  return function (msg) {
    // TODO: error checking if msg not in correct format
    self._queueChanges(partitioner._dbName, socket, msg);
  };
};

Server.prototype._registerChangesListener = function (socket, partitioner) {
  socket.on('changes', this._onChangesFactory(socket, partitioner));
};

Server.prototype._setOptions = function (useSSL, options, key, cert, ca) {
  if (useSSL) { // using https?
    options.key = fs.readFileSync(key);
    options.cert = fs.readFileSync(cert);

    if (ca) { // Certificate authority optional
      options.ca = fs.readFileSync(ca);
    }
  }
};

// Pass in https and http so that we can test SSL without a cert
Server.prototype._createServer = function (useSSL, options, https, http) {
  return useSSL ? https.createServer(options) : http.createServer();
};

Server.prototype._scheme = function (useSSL) {
  return 'http' + (useSSL ? 's' : '');
};

Server.prototype.listen = function () {
  var self = this,
    options = {},
    useSSL = config.URL.substr(0, 5).toLowerCase() === 'https';

  self._setOptions(useSSL, options, config.SSL_KEY, config.SSL_CERT, config.SSL_CA);

  var server = self._createServer(useSSL, options, https, http);

  var io = socketio(server);

  io.on('connection', function (socket) {
    log.info(socket.conn.id + ' (' + socket.conn.remoteAddress + ') connected');
    self._registerInitListener(socket);
  });

  server.listen(config.PORT, function () {
    log.info('listening on ' + self._scheme(useSSL) + '://*:' + config.PORT);
  });
};

module.exports = Server;
