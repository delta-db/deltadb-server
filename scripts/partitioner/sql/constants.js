'use strict';

// We define a Constants class to prevent circular dependencies
var Constants = {};

// * queued_ - docs queued for writing (deferred writing for speed)
// * latest_ - the latest values of each doc (used during initial sync)
// * recent_ - buffered changes since last archive (clients use this to sync unless looking for
//             changes before last archive, in which case they use latest)
// * all_    - all changes
Constants.QUEUED = 'queued_';
Constants.LATEST = 'latest_';
Constants.RECENT = 'recent_';
Constants.ALL = 'all_';

// We designate 1-999 as reserved ids in all the tables so that we can easily add system records in
// the future
Constants.ID_LAST_RESERVED = 999;

Constants.ACTION_CREATE = 'create';
Constants.ACTION_READ = 'read';
Constants.ACTION_UPDATE = 'update';
Constants.ACTION_DESTROY = 'destroy';

module.exports = Constants;