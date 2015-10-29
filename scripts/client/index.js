// TODO: shouldn't this point to delta-db.js?

require('./auto-adapter-store'); // automatically select default store

module.exports = require('./adapter');
