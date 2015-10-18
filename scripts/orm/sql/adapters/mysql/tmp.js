'use strict';

var escape = function (str) {
  return str.replace(/\W+/g, '').toLowerCase();
};


var Promise = require('bluebird'),
  utils = require('../../utils');








// FUTURE: reconnects if network problems
// NOTE: is node-mysql2 faster than node-mysql and async??

// CONNECT
var mysql = require('mysql'); // TODO: mysql or mysql2???
// var mysql      = require('mysql2'); // TODO: mysql or mysql2??? benchmark
var connection = mysql.createConnection({
  host: 'localhost',
  user: 'consulting',
  password: 'consulting'
});

// TODO: use dynamic receiver to use Promise.promisify with mongo and indexeddb adapters
var connect = Promise.promisify(connection.connect, connection);
var end = Promise.promisify(connection.end, connection);
var query = Promise.promisify(connection.query, connection);

// CREATE DATABASE
var createDatabase = function (name) {
  return query('CREATE DATABASE IF NOT EXISTS ' + escape(name) +
    ' DEFAULT CHARACTER SET utf8 DEFAULT COLLATE utf8_unicode_ci');
};

// USE DATABASE
var use = function (name) {
  return query('USE ' + escape(name));
};

// CREATE TABLE
// TODO: generalize so params would also work for Postgres
var createTable = function (name) {
  // TODO: compare speed with MyISAM vs InnoDB
  return query(
    'CREATE TABLE IF NOT EXISTS ' + escape(name) + ' ( ' +
    'id int(10) unsigned NOT NULL AUTO_INCREMENT,' +
    'param1 varchar(100) COLLATE utf8_unicode_ci DEFAULT NULL,' +
    'param2 decimal(10,0) NOT NULL,' + 'PRIMARY KEY (id),' + 'KEY param1 (param1)' +
    ') ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci AUTO_INCREMENT=1');
};

// var escapeAndJoin = function (obj) {
//   var keys = '', vals = '', delim = '';
//   utils.each(obj, function (val, key) {
//     keys += delim + escape(key);
//     vals += delim + connection.escape(val);
//     delim = ',';
//   });
//   return { keys: keys, values: vals };
// };

var escapeAndJoin = function (obj) {
  var keys = '',
    vals = '',
    valArray = [],
    delim = '';
  utils.each(obj, function (val, key) {
    keys += delim + escape(key);
    vals += delim + '?';
    valArray.push(val);
    delim = ',';
  });
  return {
    keys: keys,
    values: vals,
    valArray: valArray
  };
};

var escapeAndJoinAttrs = function (attrs) {
  var str = '',
    delim = '';
  utils.each(attrs, function (val) {
    str += delim + escape(val);
    delim = ',';
  });
  return str;
};

// INSERT ROW - and get id
var insert = function (doc, table) {
  var joined = escapeAndJoin(doc);
  return query(
    'INSERT INTO ' + escape(table) + ' (' + joined.keys + ') VALUES (' + joined.values + ')',
    joined.valArray).then(function (results) {
    if (results[0]) { // not mysql2?
      return results[0].insertId;
    } else {
      return results.insertId;
    }
  });
};

// SELECT ROWS
// TODO: where, order, limit, offset rules
var find = function (attrs, table /* , where */ ) {
  var params = escapeAndJoinAttrs(attrs);
  return query('SELECT ' + params + ' FROM ' + escape(table)).then(function (results) {
    return results[0];
  });
};

// SELECT ROW
var at = function (attrs, table, id) {
  var params = escapeAndJoinAttrs(attrs);
  return query(
    'SELECT ' + params + ' FROM ' + escape(table) + ' WHERE ' + escape('id') + '=' + connection
    .escape(id) + ' LIMIT 1').then(function (results) {
    return results[0][0];
  });
};

var escapeAndJoinUpdates = function (obj) {
  var keys = '',
    valArray = [],
    delim = '';
  utils.each(obj, function (val, key) {
    keys += delim + escape(key) + '=?';
    valArray.push(val);
    delim = ',';
  });
  return {
    keys: keys,
    valArray: valArray
  };
};

// UPDATE ROW - should this be more general like attrs, table, where???
var update = function (query, doc, table) {
  var joined = escapeAndJoinUpdates(doc);
  var numVals = joined.valArray.length;
  joined.valArray.push(doc.id);
  return query(
    'UPDATE ' + escape(table) + ' SET ' + joined.keys + ' WHERE ' + escape('id') + '=$' + (
      numVals + 1), joined.valArray);
};

// var escapeAndJoinUpdates = function (attrs) {
//   var str = '', delim = '';
//   utils.each(attrs, function (val, key) {
//     str += delim + escape(key) + '=' + connection.escape(val);
//     delim = ',';
//   });
//   return str;
// };

// UPDATE ROW - should this be more general like attrs, table, where???
var update = function (doc, table) {
  var joined = escapeAndJoinUpdates(doc);
  // var numVals = joined.valArray.length;
  joined.valArray.push(doc.id);
  return query(
    'UPDATE ' + escape(table) + ' SET ' + joined.keys + ' WHERE ' + escape('id') + '=?', joined
    .valArray);
};

// DELETE ROW
var deleteRow = function (table, id) {
  return query(
    'DELETE FROM ' + escape(table) + ' WHERE ' + escape('id') + '=' + connection.escape(id));
};

// DELETE TABLE
var deleteTable = function (name) {
  return query('DROP TABLE ' + escape(name));
};

// DELETE DATABASE
var deleteDatabase = function (name) {
  return query('DROP DATABASE ' + escape(name));
};

// TODO: CREATE USER
// TODO: DELETE USER

var db = 'REMOVE3';
var table = 'my_table';

connect().then(function () {
  return createDatabase(db);
}).then(function () {
  console.log(db + ' created');
}).then(function () {
  return use(db);
}).then(function () {
  return createTable(table);
}).then(function () {
  console.log(table + ' created');
}).then(function () {
  return insert({
    param1: 'cool!',
    param2: '7'
  }, table);
}).then(function (id) {
  console.log('inserted with id=' + id);
  return at(['id', 'param1', 'param2'], table, id);
}).then(function (doc) {
  console.log('got ' + JSON.stringify(doc));
  doc.param1 = 'coolness';
  return update(doc, table);
}).then(function () {
  return insert({
    param1: 'also cool!',
    param2: '99'
  }, table);
}).then(function () {
  return find(['id', 'param1', 'param2'], table);
}).then(function (docs) {
  console.log('docs=' + JSON.stringify(docs));
  return deleteRow(table, docs[0].id);
}).then(function () {
  return find(['id', 'param1', 'param2'], table);
}).then(function (docs) {
  console.log('after del docs=' + JSON.stringify(docs));
}).then(function () {
  return deleteTable(table);
}).then(function () {
  console.log(table + ' destroyed');
}).then(function () {
  return deleteDatabase(db);
}).then(function () {
  console.log(db + ' destroyed');
}).then(function () {
  // close connection
  return end();
}).catch(function (err) {
  console.log('ERR=' + err);
  return end();
});
