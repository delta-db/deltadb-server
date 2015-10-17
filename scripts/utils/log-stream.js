'use strict';

var fs = require('fs');

var LogStream = function (filename) {
  this._stream = fs.createWriteStream(filename, {
    'flags': 'w'
  });
};

LogStream.prototype.write = function (msg) {
  this._stream.write(msg);
};

module.exports = LogStream;