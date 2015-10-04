'use strict';

var Doc = require('../../../../../scripts/orm/nosql/common/doc'),
  utils = require('../../../../utils'),
  Promise = require('bluebird');

describe('doc', function () {

  it('should edge test', function () {
    var doc = new Doc();
    doc._set('priority', 'high', true);
    doc.dirty();
  });

// TODO: remove
// it('should have unique event emitters', function () {
//   var doc1 = new Doc(),
//     doc2 = new Doc();

// doc1.on('attr:record', function () {
//   console.log('doc1 attr:record');
// });

// doc2.on('attr:record', function () {
//   console.log('doc2 attr:record');
// });

//   var promiseFactory = function () {
//     doc1.emit('attr:record');
//     return Promise.resolve();
//   };

//   return utils.shouldDoAndNotOnce(promiseFactory, doc2, 'attr:record');
// });

});