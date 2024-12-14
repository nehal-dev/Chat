
const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);

app.use(express.static(__dirname));

const rooms = new Map();

io.on('connection', (socket) => {
    console.log('A user connected');

    socket.on('create-room', (data) => {
        const { roomId, username } = data;
        rooms.set(roomId, { users: new Set([username]) });
        socket.join(roomId);
        socket.emit('room-created', roomId);
    });

    socket.on('join-room', (data) => {
        const { roomId, username } = data;
        if (rooms.has(roomId)) {
            rooms.get(roomId).users.add(username);
            socket.join(roomId);
            socket.to(roomId).emit('user-joined', username);
            socket.emit('room-joined', roomId);
        }
    });

    socket.on('chat-message', (data) => {
        const { roomId, message, username } = data;
        io.to(roomId).emit('message', { message, username });
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
