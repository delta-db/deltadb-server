'use strict';

// TODO: Need a connection per DB? Seems wasteful, but DB may not exist yet and may need to interact
// w/ System DB to create another DB. Advantage to having separate connections is that you can
// prioritize a DB over another! If multiple DBs per socket then how to handle connections with diff
// servers if DBs on diff servers? Chosing socket per DB for now.

var app = require('express')(),
  http = require('http').Server(app),
  io = require('socket.io')(http),
  Partitioners = require('./partitioners');

var port = 3000;

var Server = function () {
  this._partitioners = new Partitioners();
};

Server.prototype._registerInitListener = function (socket) {
  var self = this;
  socket.on('init', function (msg) {
    // TODO: error checking if msg not in correct format

    // Lookup/create partitioner for DB name
    return self._partitioners.register(msg.db, socket).then(function (partitioner) {
      self._registerDisconnectListener(socket, partitioner);
      self._registerSyncListener(socket, partitioner);
    }).catch(function (err) {
      socket.emit('error', err);
    });
    // TODO: also handle authentication here?
  });
};

Server.prototype._registerDisconnectListener = function (socket, partitioner) {
  var self = this;
  socket.on('disconnect', function () {
    // Clean up
    return self._unregister(partitioner._dbName, socket).catch(function ( /* err */ ) {
      // TODO: write to log if error?
    });
  });
};

Server.prototype._registerSyncListener = function (socket, partitioner) {
  socket.on('changes', function (msg) {
    // TODO: error checking if msg not in correct format
    self._partitioners.sync(partitioner._dbName, socket);
  });
};

Server.prototype.listen = function () {
  var self = this;

  io.on('connection', function (socket) {
    self._registerInitListener(socket);
  });

  http.listen(port, function () {
    // console.log('listening on *:' + port);
  });
};

module.exports = Server;