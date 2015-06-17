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

    istanbul cover _mocha -- -g 'regex' test/test.js


Running Basic Performance Test
---

    npm run performance
