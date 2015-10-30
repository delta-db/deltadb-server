// TODO: update all references to FB with DDB

/*global todomvc, angular, Firebase */
'use strict';

/**
 * The main controller for the app. The controller:
 * - retrieves and persists the model via the $firebaseArray service
 * - exposes the model to the template and provides event handlers
 */
todomvc.controller('TodoCtrl', function TodoCtrl($scope, $location) {
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
	};

	todos.all(function (todo) {
		pushTodo(todo);
	});

	todos.on('doc:create', function (todo) {
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

// TODO: need to maintain todos array for angular!!

// $scope.render = function () {
// 	var total = 0;
// 	var remaining = 0;
// 	$scope.todos.all(function (todo) {
// 		var data = todo.get();
//
// 		// Skip invalid entries so they don't break the entire app.
// 		if (!data || !data.title) {
// 			return;
// 		}
//
// 		total++;
// 		if (data.completed === false) {
// 			remaining++;
// 		}
// 	});
// 	$scope.totalCount = total;
// 	$scope.remainingCount = remaining;
// 	$scope.completedCount = total - remaining;
// 	$scope.allChecked = remaining === 0;
// };

// $scope.todos
// 	.on('doc:create', $scope.render)
// 	.on('doc:update', $scope.render);

// TODO: how to handle watcher properly?
// 	$scope.$watch('todos', function () {
// 		var total = 0;
// 		var remaining = 0;
// 		$scope.todos.all(function (todo) {
// 			var data = todo.get();
//
// 			// Skip invalid entries so they don't break the entire app.
// 			if (!data || !data.title) {
// 				return;
// 			}
//
// 			total++;
// 			if (data.completed === false) {
// 				remaining++;
// 			}
// 		});
// // $scope.todos.forEach(function (todo) {
// // 	// Skip invalid entries so they don't break the entire app.
// // 	if (!todo || !todo.title) {
// // 		return;
// // 	}
// //
// // 	total++;
// // 	if (todo.completed === false) {
// // 		remaining++;
// // 	}
// // });
// 		$scope.totalCount = total;
// 		$scope.remainingCount = remaining;
// 		$scope.completedCount = total - remaining;
// 		$scope.allChecked = remaining === 0;
// 	}, true);

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

	$scope.doneEditing = function (todo) {
		$scope.editedTodo = null;
		var title = todo.title.trim();
		if (title) {
			$scope.todo.save();
//			$scope.todos.$save(todo);
		} else {
			$scope.removeTodo(todo);
//			$scope.todo.destroy();
		}
	};

	$scope.revertEditing = function (todo) {
		todo.title = $scope.originalTodo.title;
//		$scope.doneEditing(todo);
	};

	$scope.removeTodo = function (todo) {
//		$scope.todos.$remove(todo);
		todo.destroy();
	};

	$scope.clearCompletedTodos = function () {
		$scope.todos.all(function (todo) {

// TODO: restore after fix DDB to work with booleans
			// if (todo.get().completed) {
			if (todo.get().completed !== 'false') {
				$scope.removeTodo(todo);
			}
		});
// $scope.todos.forEach(function (todo) {
// 	if (todo.completed) {
// 		$scope.removeTodo(todo);
// 	}
// });
	};

	$scope.markAll = function (allCompleted) {
// $scope.todos.forEach(function (todo) {
// 	todo.completed = allCompleted;
// 	$scope.todos.$save(todo);
// });
		$scope.todos.all(function (todo) {
			todo.set({ completed: allCompleted ? 'true' : 'false' });
// TODO: restore after fix DDB to work with booleans
//			todo.set({ completed: allCompleted });
			todo.save();
		});
	};

	if ($location.path() === '') {
		$location.path('/');
	}
	$scope.location = $location;
});
