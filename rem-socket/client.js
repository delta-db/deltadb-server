// var io = require('socket.io')(http);

// io.on('connection', function(socket){
//   socket.on('chat message', function(msg){
//     // io.emit('chat message', msg);
//     socket.emit('chat message', msg); // just back with the same client
//   });
// });




  // var socket = io();
  // $('form').submit(function(){
  //   socket.emit('chat message', $('#m').val());
  //   $('#m').val('');
  //   return false;
  // });
  // socket.on('chat message', function(msg){
  //   $('#messages').append($('<li>').text(msg));
  // });


var io = require('socket.io-client');

// socket = io.connect('localhost', {
//     port: 3000
// });

socket = io.connect('http://localhost:3000');

socket.on('connect', function () {
  console.log("socket connected");
});
// socket.emit('private message', { user: 'me', msg: 'whazzzup?' });

// socket.emit('chat message', 'yo!');

socket.emit('chat message', { msg: 'yo!' });

socket.on('chat message', function (msg) {
	console.log('msg=', msg);
});
