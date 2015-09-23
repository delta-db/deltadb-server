'use strict';

// Need a connection per DB? Seems wasteful and DB may not exist yet and may need to interact w/
// System DB to create another DB. Advantage to having separate connections is that you can
// prioritize a DB over another! If multiple DBs per socket then how to handle connections with diff
// servers if DBs on diff servers?

// Use namespaces for each DB name??

// What is exchanged during open? Need to pass db name and authentication?

// Anything done during disconnect? What about a disconnect where reconnect doesn't happen even
// after a long time?

var app = require('express')(),
  http = require('http').Server(app),
  io = require('socket.io')(http),
  Partitioners = require('./partitioners');

var port = 3000;

var Server = function () {
  this._partitioners = new Partitioners();
};

Server.prototype._registerInitListener = function (socket) {
  socket.on('init', function ( /* msg */ ) {
    // TODO: also handle authentication here?
  });
};

Server.prototype._registerSyncListener = function (socket) {
  socket.on('sync', function ( /* msg */ ) {

  });
};

Server.prototype._registerDisconnectListener = function (socket) {
  socket.on('disconnect', function () {
    // TODO: clean up connection w/ client
  });
};

Server.prototype._registerSocketListeners = function (socket) {
  this._registerSyncListener(socket);
};

Server.prototype.listen = function () {
  var self = this;

  io.on('connection', function (socket) {
    self._registerSocketListeners(socket);
  });

  http.listen(port, function () {
    console.log('listening on *:' + port);
  });
};

module.exports = Server;