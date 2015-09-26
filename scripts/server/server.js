'use strict';

// TODO: Need a connection per DB? Seems wasteful, but DB may not exist yet and may need to interact
// w/ System DB to create another DB. Advantage to having separate connections is that you can
// prioritize a DB over another! If multiple DBs per socket then how to handle connections with diff
// servers if DBs on diff servers? Chosing socket per DB for now.

var app = require('express')(),
  http = require('http').Server(app),
  io = require('socket.io')(http),
  Partitioners = require('./partitioners'),
  log = require('../utils/log');

var port = 3000;

var Server = function () {
  this._partitioners = new Partitioners();
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

Server.prototype._registerInitListener = function (socket) {
  var self = this;
  socket.on('init', function (msg) {
    // TODO: error checking if msg not in correct format

    // Lookup/create partitioner for DB name
    return self._partitioners.register(msg.db, socket).then(function (partitioner) {
      self._registerDisconnectListener(socket, partitioner);
      self._registerSyncListener(socket, partitioner);
      self._emitInitDone(socket);
    }).catch(function (err) {
      socket.emit('error', err);
    });
    // TODO: also handle authentication here?
  });
};

Server.prototype._onDisconnectFactory = function (socket, partitioner) {
  var self = this;
  return function () {
    log.info(socket.conn.id + ' disconnected');
    return self._partitioners.unregister(partitioner._dbName, socket).catch(function ( /* err */ ) {
      // TODO: write to log if error?
    });
  };
};

Server.prototype._registerDisconnectListener = function (socket, partitioner) {
  // TODO: should disconnect really be the same as end? In my quick tests, it looks like you get a
  // new socket when you reconnect (based on conn.id) so yes. Do more research.
  socket.on('disconnect', this._onDisconnectFactory(socket, partitioner));
};

Server.prototype._registerSyncListener = function (socket, partitioner) {
  var self = this;
  socket.on('changes', function (msg) {
    // TODO: error checking if msg not in correct format
    self._partitioners.sync(partitioner._dbName, socket, msg);
  });
};

Server.prototype.listen = function () {
  var self = this;

  io.on('connection', function (socket) {
    log.info(socket.conn.id + ' (' + socket.conn.remoteAddress + ') connected');
    self._registerInitListener(socket);
  });

  http.listen(port, function () {
    log.info('listening on *:' + port);
  });
};

module.exports = Server;