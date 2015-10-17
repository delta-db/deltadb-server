Now
---
- sockets:
	- code coverage on old tests
	- merge into master
	- for test-e2e use spawn to launch server - add to CI and make sure complete coverage
	- test where db already exists and then start server and make sure server processes the db
	- test sender by making "interval" large and making a bunch of changes in a short period of time and make sure sync only called twice
	- complete e2e tests (see TODOs), including roles, user roles and make sure that handling doc id reconcilation the same way as with create/destroy db
	- event for connect. Disconnect event already exists, but add info about both to wiki
	- run on 3000 and then use iptables in production? http://stackoverflow.com/questions/23281895/node-js-eacces-error-when-listening-on-http-80-port-permission-denied. This way don't have to run app as root
- test client with idb, there will be problems as the idb adapter cannot reload at adapter layer--everything ok now?
	- add client tests to browser tests
- test with actual angular app - todomvc adaptation
- split into deltadb, deltadb-server, deltadb-sql-orm, deltadb-nosql-orm
- impl todomvc example
- Admin UI, e.g. "Delta Admin"
- impl deltadb-ng and modify todo example
- use lie instead of bluebird
- how to make it so that you don't have to download all dbs to client in order to create new db? Only want to get updates for db created by this client and during this session
- Roadmap
- mysql & mariadb adapters (benchmark for fastest to see which one should be recommended by deltadb)
	- use Sequelize to abstract all adapters?
- Doc for example use cases:
	- Everyone can read and write
	- Groups can read and write
	- Owners can read and write
	- DB per user
- ability for DB to sync from system layer so that all DBs are synced
- should be able to run spec that corresponds with module and get 100% coverage, ie don't rely on coverage from other modules
- need proper error checking so that errors are reported, e.g. when reserved names are used for attr names
- timestamp safeguard: server warns client if clock is off or else client might cause unintended doc updates
- investigate use of logger package for both server and client--replace use of in-house log

Next
---
- semver pkg
- codeclimate.com
- alternative ORM query structure using a new object called Query that inherits from Promise, e.g.
		sql.find(attrs)
		   .table(table)
			 .joins(joins) // should table and joins be combined?
			 .where(where)
			 .order(order)
			 .limit(limit)
			 .offset(offset)
			 // optional .distinct()
			 // optional .throwIfMissing()
			 .then(function (results) { })
	 Also do something similar for NoSQL ORM
- there are two "Servers" in the server code -- one should be renamed
- run on Amazon lambda and other similar services
- when using socket API, use internal sockets so that different processes can communicate changes without polling
- create mechanism for running multiple processes in case there are multiple cores on the server: server, process, archive. Make this configurable
- convert all .db({}) to .db(name)? Really, because probably need to pass host, user-uuid and password
- server and client pagination for when there are a large amount of changes (partitioner already supports pagination)
- client: ability to disconnect and leave disconnected until prompted to connect
- faster to use bcrypt instead of bcryptjs for server side only?
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
- could speed up write by writing batches to flat files and letting process routine read from files
- could speed up read for certain scenarios by caching non-essential data say every 30 mins in flat files and then having clients read just this data and only query the DB directly for the essential data. Could separate the essential and non-essential via DB's and sync modes, could then put a DB in cache mode and all syncs would be cached and the cached syncs could be rotated.
- tool in admin UI or code that helps you unit test policies
- there is no construct for transmitting col/db destroys in a delta, e.g. could have { name: '$col', value: null } to denote destroy. Is this needed?
- create RESTful API in addition to socket API?
- Currently, if we have two clients connected to the same DB and one client tries to destroy the DB then an error is reported. Is this a good safeguard or should the server force a closure of all client connections for this DB so that the DB can be destroyed?
- Use local sockets so that can have 1 server process and multiple process processes that are all talking to each other
- Make sure cannot create a DB that conflicts with the System DB
- What if lose connection to underlying DB when doing things like creating tables? Need a way of wiping out tables and retrying?
- add concept of foreign keys to SQL ORM and use it for cleaner deletions of records and their children


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
- wrap ids to prevent exceptions? Is this a concern with the attrs table? Do we need to have a process that sets the auto_increment back to 0 when it reaches a high enough number? Better to just not have ids for these tables? But then how to order attributes in a deterministic way? Need to take DB offline at this point and adjust all ids down to 0? Could prevent taking DB offline by just starting to adjust all ids with transactions once we get close to the overflow value, but then this would make the changes() call return changes out of order. http://stackoverflow.com/questions/2615417/what-happens-when-auto-increment-on-integer-column-reaches-the-max-value-in-data
- what is the best web socket framework to use that will give us max speed and num connections? https://medium.com/@denizozger/finding-the-right-node-js-websocket-implementation-b63bfca0539. Probably need to benchmark
- auto restore for when DB destroyed?
- Generate entire RESTful API, including swagger docs with just MSON and DeltaDB store. This could be good for third parties that don't want to use DeltaDB to access the data.


Docs
----
- Post about storing all data at attr layer if want to make changes to docs atomic, e.g. couchdb-like conflict resolution


Misc
---
- Use BaaS (Backend as a Service) phrase?
- Create a repo with vagrant that benchmarks deltadb, pouchdb, delta-pouch, firebase & meteor
