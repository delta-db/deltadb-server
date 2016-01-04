Now
---
- Install docs:
	- Docker (recommended)
	- Manual
	- Dev (vagrant)
- Doc on how to run port 80 with iptables: http://stackoverflow.com/questions/23281895/node-js-eacces-error-when-listening-on-http-80-port-permission-denied.
- event for connect. Disconnect event already exists, but add info about both to wiki
- ability for DB to sync from system layer so that all DBs are synced between 2 servers
- create managed service on AWS
- website
	- An offline-first database
	- Example: DeltaDB is ???
		- Or: better to have messenger? Which is more simple?
	- Slick example for demo on homepage. Easy example for getting started
		- Probably best to have todomvc example on homepage and then use "DeltaDB is" for getting started
- getting started tutorial


Next 1
---
- Create way to point to local dev copies of all sub projects, e.g. deltadb-orm-nosql, so that dev can be done without building a new npm package or manually modifying files in node_modules
- How to best handle timing of initial connection? (needs to be streamlined and handled behind the scenes)
	- User registers with account
	- Creates docs
	- Initial connection creates user and then a new connection is made that authenticates with the new user?
	- Then the docs are synced?
	- Changes? Need a way to save that user creation is in progress and make sure this is done before anything else and then force a reconnect? Have to imagine that the app could be completely offline when the user is created and docs are created and it doesn't go online until after quite some use.
- impl deltadb-ng
- Clean up DeltaDB constructor? e.g. new DeltaDB('https://user:pass@example.com/mydb')
	- Probably not a good idea as we eventually want password to be char array for security!!
- Tutorials:
	- How to set up a DB cluster (note about if have only 1 server then need to set quorum config)
- Tests:
	- test sender by making "interval" large and making a bunch of changes in a short period of time and make sure sync only called twice
- todomvc example w/ react and another w/ ember
- Error Reporting
	- How to report errors, e.g. ForbiddenErrors, to client? What other errors can we expect? If the underlying DB is unavailable then a retry will solve the problem.
	- 1: Don't do any reporting and expect client to retry and if permanent error (is there such a thing?) then expect client to know why
	- 2: Store error deltas, like recordings with name and value, but also with an error code
- Admin UI, e.g. "Delta Admin"
- mysql & mariadb adapters (benchmark for fastest to see which one should be recommended by deltadb)
	- use Sequelize to abstract all adapters?
- Doc for example use cases:
	- Everyone can read and write
	- Groups can read and write
	- Owners can read and write
	- DB per user
- should be able to run spec that corresponds with module and get 100% coverage, ie don't rely on coverage from other modules
- need proper error checking so that errors are reported, e.g. when reserved names are used for attr names
- See Timestamp Skew in ISSUES
- Wouldn't it be better if addRole/removeRole returned a doc that you could wait for 'doc:record' instead of the promise not resolving until the recording?? Is this possible?
- System DB: Enhance so all system deltas must be recorded before db continues sending? Or would this cause problems with some use cases?
- System DB: close socket when not needed or else we have 2 sockets per DB!

Next 2
---
- add auto archiving to server
- complete e2e tests (see TODOs), including roles, user roles and make sure that handling doc id reconcilation the same way as with create/destroy db
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
- update to travis' new infrastructure (away from legacy setup)
- run on Amazon lambda and other similar services
- when using socket API, use internal sockets so that different processes can communicate changes without polling
- create mechanism for running multiple processes in case there are multiple cores on the server: server, process, archive. Make this configurable
- server and client pagination for when there are a large amount of changes (partitioner already supports pagination)
- client: ability to disconnect and leave disconnected until prompted to connect
- faster to use bcrypt instead of bcryptjs for server side only?
- create tour like slack product tour
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
- Allow two different instances of the same client to point to the same underlying store. Currently, the breakdown occurs when both instances try to create the same DB simultaneously, which results in only one of the clients sending both "create DB" deltas to the server, causing the 2nd client to hang as it never gets confirmation that the DB was created. Is there an easy way to prevent these clients from competing in this way?
- multiple instances of same IDB in 2 tabs:
	- We use shared adapters within the same app to support this functionality, but don't have a good solution for multiple tabs. We could just no support this at this time. We could detect the use in two browsers using some instance id and a timestamp and then display an alert to the user if we detect two tabs
	- Future option: have IDB be fault tolerant so if say creating same DB at same time then handle errors and try to reopen. Simulate with unit tests on IDB.
	- could also develop concept of session instance of DB, e.g. prefix DB with '1', '2', etc... but then how to coordinate which tab gets with DB?
- investigate use of logger package for both server and client--replace use of in-house log
- Way of specifying name of client store so that we can have 2 DBs with the same name, e.g. '$system', that point point to different servers
- Is there a better form of authentication that doesn't require the client to store the password? A token would be nice. We could require the user to enter their username and password when the client goes online and then store a token and not the password. Then whenever the token expires and the user is online, they would have to enter their password again.
- Need to separate user password into another attr so that by default it can be hidden from users with policy
- Use transactions when creating initial SQL database so that if a connection to the server is lost then can retry without worrying about missing tables? Or, could do a remove SQL db if installation not finished


Future?
---
- make checking for local changes more efficient? Currently, need to loop through all docs, even those that have not changed and this could be very inefficient when there are a lot of docs. Could make the collection keep track of doc ids that have changed and only check these docs.
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
	- Instead of using transactions, could also duplicates all the records, but with different (lower) ids and then after all the data is duplicated, removes the originals
	- Could also develop notion of hotswapping servers:
		- Let' say we have servers A & B
		- Spin up new server, C
		- C syncs with A
		- C replaces A in regards to client facing and syncing with B
		- C syncs with A (to get any changes since the last sync and the replacement)
		- Destroy A
- what is the best web socket framework to use that will give us max speed and num connections? https://medium.com/@denizozger/finding-the-right-node-js-websocket-implementation-b63bfca0539. Probably need to benchmark
- auto restore for when DB destroyed?
- Generate entire RESTful API, including swagger docs with just MSON and DeltaDB store. This could be good for third parties that don't want to use DeltaDB to access the data.
- DB/User Sharding:
	- Scenario: DB-per-user with millions of users
	- Construct:
		- Router:
			- keeps list of where each user's DB is stored
			- could also just use user-uuid which in itself could be used for routing
		- DBs then stored on different servers
		- Phase 2: feature to rebalance/move DB's to another server if say running out of space
- Design Doc/Stored Procedures:
	- Scenario: only certain users can create their own DB when they can say an InvitationID
	- Construct:
		- Privileged user can create stored procedure that upon syncing will run on server and creates a user if the InvitationID is valid
		- Client can then go about using new DB
- What is the best thing to do when a policy already exists? Should we send warnings to client so that it can be informed that policy already set? Currently, a server log entry is made
- Sessions? Only needed if we develop a RESTful API?
	- Use token after authentication
	- token expiration should be refreshed with each sync
	- token expiration configurable
	- client gets new token after token expiration
- Split off selenium/browser/saucelabs custom code into separate repo once figure out how it would need to be used with deltadb-client, etc…
- common-utils build (and everything else as a result)
  - node-uuid contributes 500K alone!!
  - bluebird adds 176k--can we use lie instead to make this smaller?
  - bcryptjs adds 600k
- Create a repo with vagrant that benchmarks deltadb, pouchdb, delta-pouch, firebase & meteor


NoSQL support
---
- CouchDB
- Indexes
- LevelDB
- firebase (can use to make fb offline-first)
- Riak
- etc...


Docs
----
- Post about storing all data at attr layer if want to make changes to docs atomic, e.g. couchdb-like conflict resolution

Misc
---
- Use BaaS (Backend as a Service) phrase?
