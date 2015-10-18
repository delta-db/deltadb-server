'use strict';

var inherits = require('inherits'),
  CommonDoc = require('../../common/doc');

var Doc = function ( /* data, collection */ ) {
  CommonDoc.apply(this, arguments); // apply parent constructor
};

inherits(Doc, CommonDoc);

module.exports = Doc;
