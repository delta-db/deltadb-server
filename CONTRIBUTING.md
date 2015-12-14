Contributing
====

Beginning Work on an Issue
---
	Create branch
	git clone branch-url


Committing Changes
---
[Commit Message Format](https://github.com/angular/angular.js/blob/master/CONTRIBUTING.md#commit)

	npm run coverage
	npm run beautify
	git add -A
	git commit -m msg
	git push


Updating Dependencies
---
This requires having david installed globally, which is already handled by our vagrant setup.

	david update


Publishing to npm
---

	tin -v VERSION
	npm run build
	git add -A
	git commit -m 'VERSION'
	git tag vVERSION
	git push origin master --tags
	npm publish


Updating gh-pages
---

    git checkout gh-pages
    git merge master
    git push


Run single test
---

    node_modules/mocha/bin/mocha -g 'default policy' test


Run subset of tests and analyze coverage
---

	node_modules/istanbul/lib/cli.js cover _mocha -- -g 'regex' test


Running Basic Performance Test
---

    npm run test-performance


Running Tests in PhantomJS
---

    $ npm run browser-test-phantomjs


You can filter the PhantomJS tests using the GREP env variable, e.g.

    $ GREP='e2e basic' npm run browser-test-phantomjs


Running Tests in Chrome and Firefox Automatically
---

Currently, this cannot be done in the VM as this project has not been configured to run Chrome and Firefox via Selenium headlessly. You can however use

    $ npm run test-firefox
    $ npm run test-chrome

to test outside the VM, assuming you have Firefox and Chrome installed.


Running Tests In Any Browser Manually
---

    $ npm run browser-server
    $ ./test/deltadb-server # in a separate window
    Point any browser to http://127.0.0.1:8001/test/index.html
    You can also run a specific test, e.g. http://127.0.0.1:8001/test/index.html?grep=mytest


Debugging Tests Using Node Inspector
---

    $ node-inspector # leave this running in this window
    Use *Chrome* to visit http://127.0.0.1:8080/?ws=127.0.0.1:8080&port=5858
    $ mocha -g 'should restore from store' test --debug-brk
