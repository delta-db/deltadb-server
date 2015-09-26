'use strict';

var Sender = function (db) {
  this._db = db;
  this._sending = false;
  this._lastSent = new Date();
};

Sender.SEND_EVERY_MS = 1000;

// TODO: need to worry about duplicate changes being sent? Can a ts be updated so that this is prevented?
Sender.prototype._doSend = function () {
  return this._db._syncWithRemote();
};

Sender.prototype._sendLoop = function () {
  var self = this;
  if (self._lastSent.getTime() > self._requested.getTime()) { // nothing more to send?
    self._sending = false;
  } else {
    self._lastSent = new Date();
    self._doSend().then(function () {
      setTimeout(self._sendLoop, self.SEND_EVERY_MS);
    });
  }
};

Sender.prototype.send = function () {
console.log('Sender.prototype.send');
// TODO: clean up comments for here
// - when there is a new client change:
//   - create a 'change' event that bubbles up to db
//   - db then kicks off a sync process if not already syncing. If already syncing then sets timestamp
//   - when current sync process completes it checks the timestamp and determines if it needs to sync again
//   - test by making "interval" large and making a bunch of changes in a short period of time and make sure sync only called twice
  this._requested = new Date();

  if (!this._sending) {
    this._sending = true;
    this._sendLoop();
  }
};

module.exports = Sender;