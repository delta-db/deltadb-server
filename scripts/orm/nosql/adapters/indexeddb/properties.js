// TODO: remove??

// 'use strict';

// // IndexedDB doesn't have a cross-browser construct for retrieving a list of all the DBs,
// // therefore we create a '$props' DB that will store this info.

// var Doc = require('../../common/doc');

// var Properties = function (adapter) {
//   this._adapter = adapter;

//   this._data = {}; // cache in memory to prevent retrieving the doc each time from the store
//   this._data[Properties.DBS_NAME] = [];
//   this._data[Doc._idName] = Properties.PROPS_NAME;
// };

// Properties.PROPS_NAME = '$props';

// Properties.DBS_NAME = 'dbs';

// Properties.prototype._prepProps = function () {
//   var self = this;
//   if (!self._props) { // not already initialized?
//     self._propsDB = self._adapter.db({ db: Properties.PROPS_NAME });
//     self._propsReady = self._propsDB._load().then(function () {
//       return self._propsDB.col(Properties.PROPS_NAME);
//     }).then(function (col) {
//       self._propsCol = col;
//       return self._propsCol.get(Properties.PROPS_NAME);
//     }).then(function (doc) {
//       if (doc) { // exists?
//         self._props = doc;
//         self._data = doc.get();
//       } else {
//         doc = self._propsCol.doc(self._data);
//         self._props = doc;
//         return doc.save();
//       }
//     });
//   }
//   return self._propsReady;
// };

// Properties.prototype.set = function (name, value) {
//   var self = this;
//   return self._prepProps().then(function () {
//     self._data[name] = value;
//     return self._props.set({ name: value });
//   });
// };

// Properties.prototype.get = function (name) {
//   var self = this;
//   return self._prepProps().then(function () {
//     return self._data[name];
//   });
// };

// Properties.prototype.dbs = function (callback) {
//   return this.get(Properties.DBS_NAME).then(function (dbs) {
//     dbs.forEach(callback);
//   });
// };

// module.exports = Properties;