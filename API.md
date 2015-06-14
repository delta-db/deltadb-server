Note
---
These API docs define how the API will most likely work in the near future and *not* how it currently works. Almost all of the core technology needed to implement these features has already been developed, but there are some small naming and structural differences. For actual details on how the DB currently works, take a look at the tests at test/e2e/index.js and test/spec/client/client.js. Please check back soon for more an up-to-date spec and proper examples and tutorials.


General
---
† = Function returns a promise.


Instantiate DB
----
var db = new DeltaDB('mydb', 'example.com', 'username', 'password');


Create Collection
----
var col = db.col('mycollection');


Create Doc
----
var doc = col.doc({ thing: 'play', priority: 'medium' });


Update Doc †
----
doc.put({ priority: 'high' });
or
doc.set({ priority: 'high' });
doc.put();


Destroy Doc †
----
doc.destroy();


Destroy Collection †
----
col.destroy();


Document Layer Events
----
doc.on('attr:create', callback);
doc.on('attr:update', callback);
doc.on('attr:destroy', callback);
doc.on('attr:record', callback);
doc.on('doc:create', callback);
doc.on('doc:update', callback);
doc.on('doc:destroy', callback);
doc.on('doc:record', callback);


Collection Layer Events
----
col.on('attr:create', callback);
col.on('attr:update', callback);
col.on('attr:destroy', callback);
col.on('attr:record', callback);
col.on('doc:create', callback);
col.on('doc:update', callback);
col.on('doc:destroy', callback);
col.on('doc:record', callback);
col.on('col:create', callback);
col.on('col:update', callback);
col.on('col:destroy', callback);
col.on('col:record', callback);


DB Layer Events
----
db.on('attr:create', callback);
db.on('attr:update', callback);
db.on('attr:destroy', callback);
db.on('attr:record', callback);
db.on('doc:create', callback);
db.on('doc:update', callback);
db.on('doc:destroy', callback);
db.on('doc:record', callback);
db.on('col:create', callback);
db.on('col:update', callback);
db.on('col:destroy', callback);
db.on('col:record', callback);
db.on('db:create', callback);
db.on('db:update', callback);
db.on('db:destroy', callback);
db.on('db:record', callback);


Client Layer Events
----
client.on('attr:create', callback);
client.on('attr:update', callback);
client.on('attr:destroy', callback);
client.on('attr:record', callback);
client.on('doc:create', callback);
client.on('doc:update', callback);
client.on('doc:destroy', callback);
client.on('doc:record', callback);
client.on('col:create', callback);
client.on('col:update', callback);
client.on('col:destroy', callback);
client.on('col:record', callback);
client.on('db:create', callback);
client.on('db:update', callback);
client.on('db:destroy', callback);
client.on('db:record', callback);


Use or Create DB
----
var db = new DeltaDB('mydb', 'example.com', 'username', 'password');


Destroy DB †
----
db.destroy();


Create User †
----
db.createUser('uuid', 'username', 'password', 'enabled');


Create User †
----
db.updateUser('uuid', 'username', 'password', 'disabled');


Destroy User (TODO) †
----
db.destroyUser('uuid');


Add Role †
----
db.addRole('useruuid', 'rolename');


Remove Role †
----
db.removeRole('useruuid', 'rolename');


Policy Format
----
var policy = {
  col: {
    create: 'arole',
    read: ['arole', 'brole'],
    update: 'arole'
    destroy: 'arole'
  },
  
  attrs: {
    thing: {
      create: 'arole',
      read: ['arole', 'brole'],
      update: 'arole'
      destroy: 'arole'
    }
  }
};
Special: $all, $owner, and implicit role


Set DB Policy †
----
db.policy(policy);


Set Collection Policy †
----
col.policy(policy);


TODO: separate into general definition and example