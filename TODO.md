Now
---
- events all the way down to the attr layer, e.g. when change recorded
  - emit doc instead of attr for doc: events - update code and wiki
  - emit col instead of attr for col: events - update wiki
- API docs - review NoSQL ORM and make any changes
- Roadmap
- client code needs to persist latest, changes, since, etc... Probably need more functions to be promises like collection.define()
- express (or better) server - use web socket
- test with actual angular app (notewall w/o encryption) - impl deltadb-ng
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

Misc
---
Use BaaS (Backend as a Service) phrase?

