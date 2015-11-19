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


Building
---

	npm run build

Publishing to both npm and bower
---

	tin -v VERSION
	npm run build
	git add -A
	git commit -m 'VERSION'
	git tag vVERSION
	git push origin master --tags
	npm publish

or, you can use: [tin-npm](https://gist.github.com/redgeoff/73b78d3b7a6edf21644f), e.g.

	tin-npm 0.0.2

Updating gh-pages
---

    git checkout gh-pages
    git merge master
    git push

Setup for gh-pages (only do once)
---

	git checkout -b gh-pages
	git push --set-upstream origin gh-pages
	git push

Setup Travis CI (only do once)
---

[Setup Travis CI](http://docs.travis-ci.com/user/getting-started/)

	Make small change to any file, e.g. add _Testing_ to the end of [README.md](README.md)
	git add -A
	git commit -m "feat(travis): first build for travis"
	git push


Run single test
---

    node_modules/mocha/bin/mocha -g 'default policy' test/test.js


Run subset of tests and analyze coverage
---

	node_modules/istanbul/lib/cli.js cover _mocha -- -g 'regex' test/test.js


Running Basic Performance Test
---

    npm run performance


Running Tests in PhantomJS
---

    $ npm run new-test-phantomjs

You can then view code coverage details by visiting coverage/lcov-report/index.html

You can filter the PhantomJS tests using the GREP env variable, e.g.

    $ GREP='e2e basic' npm run new-test-phantomjs 


Running Tests in Chrome and Firefox Automatically
---

Currently, this cannot be done in the VM as this project has not been configured to run Chrome and Firefox via Selenium headlessly. You can however use

    $ npm run test-firefox
    $ npm run test-chrome

to test outside the VM, assuming you have Firefox and Chrome installed.


Running Tests Without Code Coverage In Any Browser Manually

    $ npm run dev-server
    $ ./test/server # in a separate window
    Point any browser to http://127.0.0.1:8001/test/index.html
    You can also run a specific test, e.g. http://127.0.0.1:8001/test/index.html?grep=mytest


Running Tests With Code Coverage In Any Browser Manually

TODO: get source maps working with this solution so that we can move away from the "without coverage" method above.

    $ npm run build-test-coverage && npm run new-dev-server
    $ ./test/server # in a separate window
    Point any browser to http://127.0.0.1:8001/test/new-index.html
    You can also run a specific test, e.g. http://127.0.0.1:8001/test/new-index.html?grep=mytest


Debugging Tests Using Node Inspector
---

    $ node-inspector # leave this running in this window
    Use *Chrome* to visit http://127.0.0.1:8080/?ws=127.0.0.1:8080&port=5858
    $ mocha -g 'should restore from store' test/test.js --debug-brk
