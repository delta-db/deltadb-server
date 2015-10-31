// TODO: update all references to FB with DDB

// TODO: fix destroy

// TODO: test with two browsers

// TODO: when mark as completed, why is title change also being sent to server?

/*global todomvc, angular, Firebase */
'use strict';

/**
 * The main controller for the app. The controller:
 * - retrieves and persists the model via the $firebaseArray service
 * - exposes the model to the template and provides event handlers
 */
todomvc.controller('TodoCtrl', function TodoCtrl($scope, $location, $timeout) {
	var db = new DeltaDB('todosdb', 'http://localhost:8080');

	// The following will go away when we move to not have a system DB tracked by the client
	var system = new DeltaDB('$system', 'http://localhost:8080');

//	var url = 'https://todomvc-angular.firebaseio.com/todos';
//	var fireRef = new Firebase(url);

	// Bind the todos to the firebase provider.
//	$scope.todos = $firebaseArray(fireRef);
//	$scope.todos = db.col('todos');
	var todos = db.col('todos');
	$scope.todos = [];
	$scope.newTodo = '';
	$scope.editedTodo = null;

	var pushTodo = function (todo) {
		var data = todo.get();
// TODO: remove after fix booleans
		data.completed = data.completed === 'true';
		$scope.todos.push(data);
		$scope.$apply(); // update UI
	};

	todos.on('doc:create', function (todo) {
		// Doc was created so add to array
		pushTodo(todo);
	});

	var findIndex = function (id) {
		var index = null;
		$scope.todos.forEach(function (todo, i) {
			if (todo.$id === id) {
				index = i;
			}
		});
		return index;
	};

	var destroyTodo = function (todo) {
		var index = findIndex(todo.$id);
		if (index !== null) { // found?
			$scope.todos.splice(index, 1);
		}
	};

	todos.on('doc:update', function (todo) {
		var i = findIndex(todo.id());
// TODO: need to merge with todos? What does todo contain?
//		$scope.todos[i]
	});

	$scope.$watch('todos', function () {
		var total = 0;
		var remaining = 0;

		$scope.todos.forEach(function (todo) {
			// Skip invalid entries so they don't break the entire app.
			if (!todo || !todo.title) {
				return;
			}

			total++;
			if (todo.completed === false) {
				remaining++;
			}
		});

		$scope.totalCount = total;
		$scope.remainingCount = remaining;
		$scope.completedCount = total - remaining;
		$scope.allChecked = remaining === 0;
	}, true);

	$scope.addTodo = function () {
		var newTodo = $scope.newTodo.trim();
		if (!newTodo.length) {
			return;
		}

		var todo = todos.doc({
			title: newTodo,
// TODO: enhance DDB to work with booleans, i.e. false is not considered attr delete, only null is
			// completed: false
			completed: 'false'
		});

		todo.save();

		$scope.newTodo = '';
	};

	$scope.editTodo = function (todo) {
		$scope.editedTodo = todo;
		$scope.originalTodo = angular.extend({}, $scope.editedTodo);
	};

	$scope.save = function (todo) {
		todos.get(todo.$id).then(function (todoDoc) {
// TODO: remove after fix booleans
			var formattedTodo = angular.extend({}, todo);
			formattedTodo.completed = formattedTodo.completed ? 'true' : 'false';
			return todoDoc.set(formattedTodo);
		});
	};

	$scope.doneEditing = function (todo) {
		$scope.editedTodo = null;
		var title = todo.title.trim();
		if (title) {
			$scope.save(todo);
		} else {
			$scope.removeTodo(todo);
		}
	};

	$scope.revertEditing = function (todo) {
		todo.title = $scope.originalTodo.title;
		$scope.doneEditing(todo);
	};

	$scope.removeTodo = function (todo) {
		destroyTodo(todo);
		todos.get(todo.$id).then(function (todoDoc) {
			return todoDoc.destroy();
		});
	};

	$scope.clearCompletedTodos = function () {
		$scope.todos.forEach(function (todo) {
			if (todo.completed) {
				$scope.removeTodo(todo);
			}
		});
	};

	$scope.markAll = function (allCompleted) {
		$scope.todos.forEach(function (todo) {
			todo.completed = allCompleted;
			$scope.save(todo);
		});
	};

	if ($location.path() === '') {
		$location.path('/');
	}
	$scope.location = $location;
});
