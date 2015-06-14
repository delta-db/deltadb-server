'use strict';

var beautify = require('js-beautify').js_beautify,
  fs = require('fs'),
  mkdirp = require('mkdirp');

var argv = require('minimist')(process.argv.slice(2));

var walk = require('walk');

var path = require('path');

// TODO: make -i and -o also work with absolute paths
if (!argv.i || !argv.o || !argv.c) {
  console.log('Usage: beautify-proj -i dir -o dir -c json-config');
  return;
}

var read = function (filename, callback) {
  fs.readFile(filename, 'utf8', function (err, data) {
    if (err) {
      throw err;
    }
    callback(data);
  });
};

var write = function (filename, data) {
  mkdirp(path.dirname(filename), function (err) { // create dir if needed
    if (err) {
      throw err;
    }
    fs.writeFile(filename, data, function (err) {
      if (err) {
        throw err;
      }
    });
  });
};

var beautifyFile = function (filename, options) {
  read(filename, function (data) {
    var beautifulData = beautify(data, options);
    var outFilename = argv.o + '/' + filename;
    write(outFilename, beautifulData);
  });
};

var beautifyAll = function (options) {
  var walker = walk.walk(argv.i, {
    followLinks: false
  });
  walker.on('file', function (root, stat, next) {
    var filename = root + '/' + stat.name;
    var ext = path.extname(filename);
    if (ext === '.js') {
      beautifyFile(filename, options);
    }
    next();
  });
};

read(argv.c, function (data) { // read config
  var options = JSON.parse(data);
  beautifyAll(options);
});