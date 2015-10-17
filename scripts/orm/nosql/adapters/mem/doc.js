'use strict';

var inherits = require('inherits'),
  CommonDoc = require('../../common/doc'),
  utils = require('../../../../utils');

var Doc = function ( /* data, collection */ ) {
  CommonDoc.apply(this, arguments); // apply parent constructor

  // Register pending doc
  this._pendingID = utils.uuid();
  this._col._pendingDocs[this._pendingID] = this;
};

inherits(Doc, CommonDoc);

module.exports = Doc;