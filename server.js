var express = require('express');
var app = express();
var server = require('http').Server(app);
var io = require('socket.io')(server);
io.set('transports', ['websocket']);
var PORT = process.env.OPENSHIFT_INTERNAL_PORT || process.env.OPENSHIFT_NODEJS_PORT;
var IPADDRESS = process.env.OPENSHIFT_INTERNAL_IP || process.env.OPENSHIFT_NODEJS_IP;

// open port for communication
server.listen(PORT, IPADDRESS, function() {
	console.log('Listening on ip: %s, on port: %d', IPADDRESS, PORT);
});

//set static folder for application
app.use(express.static('public'));

// serve application
app.get("/", function(request, response) {
	response.sendFile(__dirname + '/index.html');
});

var rooms = [];
var roomCounter = 0;
function Room(id) {
	this.name = 'room' + roomCounter++;
	this.players = [id];
}

// new connection event
io.sockets.on('connection', function(socket) {
	console.log(socket.id + ' - connected');
	var room;
	// connection lost event
	socket.on('disconnect', function() {
		console.log(socket.id + ' - disconnected');
		if(room) leaveRoom(socket, room);
		if(rooms.length > 0) {
			if(rooms[rooms.length - 1].players.length === 0) {
				rooms.pop();
				roomCounter--;
			}
		}
	});
	// user requests matchmaking
	socket.on('find-match', function() {
		console.log(socket.id + ' - started match');
		room = joinOrCreateRoom(socket.id);
		socket.join(room.name);
		// set host of match
		console.log(socket.id + ' - ' + room.name);
		console.log('Room Count = ' + rooms.length);
		if(room.players.length === 2) {
			// start match
			if(room.players[0] === socket.id) {
				socket.emit('start-match', { isHost: true });
				socket.broadcast.to(room.name).emit('start-match', { isHost: false });
			} else {
				socket.emit('start-match', { isHost: false });
				socket.broadcast.to(room.name).emit('start-match', { isHost: true });
			}
			// emit simulation frames to all non-host players in room
			socket.on('simulation-frame', function(data) {
				socket.broadcast.to(room.name).emit('simulation-frame', data);
			});	
		}
	});
});

// searches for open rooms to join or creates new room
function joinOrCreateRoom(clientId) {
	var firstAvailableRoom = rooms.filter(function(room) { return room.players.length === 1; })[0];
	if(!firstAvailableRoom) {
		var newRoom = new Room(clientId);
		rooms.push( newRoom );
		return newRoom;
	}
	firstAvailableRoom.players.push( clientId );
	return firstAvailableRoom;
}

// remove socket from room then remove room if empty
function leaveRoom(socket, room) {
	socket.leave(room.name);
	room.players.splice(room.players.indexOf(socket.id), 1);
}