Now
---
- use FireFox & Chrome to test indexeddb adapter
  - need 100% coverage
  - make sure travisci tests passing including for phantomjs, firefox and chrome
	- Convert all adapters to make db.col() not return a promise and update API docs
	- convert all .db({}) to .db(name)
	- split into deltadb, deltadb-server, deltadb-sql-orm, deltadb-nosql-orm
- fix error:
  3) deltadb partitioner sql changes offset should get changes by offset:

      AssertionError: expected [ Array(6) ] to deeply equal [ Array(6) ]
      + expected - actual

       [
         {
           "col": "task"
      -    "id": "5"
      +    "id": "1"
           "name": "prority"
           "re": "2015-09-14T01:15:43.050Z"
           "up": "2015-09-14T01:15:42.871Z"
           "val": "\"low\""
         }
         {
           "col": "task"
      -    "id": "6"
      +    "id": "2"
           "name": "prority"
           "re": "2015-09-14T01:15:43.101Z"
           "up": "2015-09-14T01:15:42.871Z"
           "val": "\"low\""
         }
         {
           "col": "task"
      -    "id": "7"
      +    "id": "3"
           "name": "prority"
           "re": "2015-09-14T01:15:43.141Z"
           "up": "2015-09-14T01:15:42.871Z"
           "val": "\"low\""
         }
         {
           "col": "task"
      -    "id": "8"
      +    "id": "4"
           "name": "prority"
           "re": "2015-09-14T01:15:43.182Z"
           "up": "2015-09-14T01:15:42.871Z"
           "val": "\"low\""
         }
         {
           "col": "task"
      -    "id": "9"
      +    "id": "5"
           "name": "prority"
           "re": "2015-09-14T01:15:43.221Z"
           "up": "2015-09-14T01:15:42.871Z"
           "val": "\"low\""
      
      at Utils.eqls (test/utils.js:34:30)
      at Utils.changesShouldEql (test/utils.js:350:8)
      at test/spec/partitioner/sql/changes/offset.js:52:17
- faster to use bcrypt instead of bcryptjs for server side only?
- express (or better) server - use web socket
- test client with idb, there will be problems as the idb adapter cannot reload at adapter layer
- test with actual angular app (notewall w/o encryption) - impl deltadb-ng
- use lie instead of bluebird
- Roadmap
- Admin UI, e.g. "Delta Admin"
- mysql adapter
- Doc for example use cases:
	- Everyone can read and write
	- Groups can read and write
	- Owners can read and write
	- DB per user
- ability for DB to sync from system layer so that all DBs are synced
- should be able to run spec that corresponds with module and get 100% coverage, ie don't rely on coverage from other modules
- create a debug mode that allows DeltaDB to write a lot of info to a log
- need proper error checking so that errors are reported, e.g. when reserved names are used for attr names
- timestamp safeguard: server warns client if clock is off or else client might cause unintended doc updates

Next
---
- create tour like slack product tour
- Split into projects:
	- SQL ORM
	- deltadb-server
	- deltadb (client)
- clean up SQL error handling. Only ignore SQL errors when the exact error is known, e.g. doing a createOrUpdate and race condition from someone else creating doc first then should generate DuplicateError and if caught then can move on to doing the update
- some of the tests, e.g. nosql/common/where don't really test the functionality they just satisfy the 100% code coverage--they should test functionality
- consistency test:
	- simulate 2 clients with random and predictable ids and timestamps performing CRUD operations
	- have 2 servers syncing with each other
	- dump ALL from both servers and make sure that when sort by updated_at that all data is the same
	- run test over many hours to test for randomness and log every queued change
- CouchDB adapter to make sure nosql orm is generalized properly 
- ability to query historical data
- create compaction routine that removes historical data (ALL)
- DDOS/bruteforce protection:
	- maintain list of IPs
	- if same IP fails to login in X seconds then temporarily block the IP
- option to log every queued change
- command line tool for creating/modifying DB, user, etc...
- when changes are recorded and then sent back to client, etc... then only pass id and recorded_at to save bandwidth?
- could speed up write by writting batches to flat files and letting process routine read from files
- could speed up read for certain scenarios by caching non-essential data say every 30 mins in flat files and then having clients read just this data and only query the DB directly for the essential data. Could separate the essential and non-essential via DB's and sync modes, could then put a DB in cache mode and all syncs would be cached and the cached syncs could be rotated.
- tool in admin UI or code that helps you unit test policies
- there is no construct for transmitting col/db destroys in a delta, e.g. could have { name: '$col', value: null } to denote destroy. Is this needed?

NoSQL support
---
- CouchDB
- Indexes
- LevelDB
- firebase (can use to make fb offline-first)
- Riak
- etc...

Future?
---
- test in all browsers using saucelabs
- does ring of servers provide enough syncing speed, e.g. A->B->C->A or need a star, star of rings or star of stars? Or variation of star where two servers are in middle, e.g. A<->M1, B<->M1, C<->M1, A<->M2, B<->M2, C<->M2
- https://github.com/axemclion/IndexedDBShim?
- use deltadb to sync different types of DBs, e.g. Mongo with MySQL
- for very fast setup could use LevelDB to interact with clients and then have LevelDB sync with DB like Mongo for backups. Just need to worry about a "log" so that if LevelDB crashes before syncing then data isn't lost
- stored procedures that work like sql wrapper (that take JS arguments) for faster access?
- concept that allows for guaranteed backup of specific data: e.g. flag in queued_ table that when on, sync requires syncing server to establish connection with another server(s) and write to queued_ table before sync with client is accepted. This way, if the first server crashes and is unrecoverable then the data is not lost. Could be useful for say financial data. Currently, the clients will retry until a quorum is reached--isn't this enough?
- create SQLlite adapter. Faster to perform main tests with this adapter than with Postgres/MySQL?
- ability to sync data doc/collection in real-time, i.e. need prioritized syncing streams for certain data?
- faster if we render static files of buffered data based on configurable increments like every 5 minutes and then server can just dump files - benchmark to see speed improvement
- option for a couch-like conflict resolution, all-or-nothing: if no one else has changed any data for doc then you can proceed, otherwise failure--can use a rev at the doc level or even last updated timestamp
- write version of deltadb in C for extra speed?
- native clients for Android and iOS
- Angular, Ember, React Adapters (see Firebase adapters) -- use wrapend and then extend to wrapend-ng, wrapend-ember, etc..
- mem adapter that syncs with underlying IndexedDB adapter so can perform searches, etc... in mem, but still have persistent data
- how can client get historical data, e.g. viewing audit trail - easy tool to get snapshot of doc anywhere within that history
- We currently use git diff --no-index with a copy of the original and beautified files as git diff --no-index doesn't appear to support an exclude dir option. It may be faster to use the jsdiff proj to write a custom script to accomplish this
- relations and foreign keys
- model functions (https://github.com/dresende/node-orm2)
- can trigger restore with updating attr?
- Figure out a way to use Selenium with Chrome and Firefox in a headless state on a VM. Or, just rely on testing with saucelabs and only test phantomjs in VM?
- indexeddb orm testing in node with indexeddbshim? Probably not easy as can use mock-browser, but node-sqlite3 doesn't present a WebSQL wrapper. opendatabase doesn't appear to be full featured enough => just test indexedb code in browser for now


Misc
---
Use BaaS (Backend as a Service) phrase?

