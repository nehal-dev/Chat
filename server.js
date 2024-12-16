const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static(__dirname)); // Serve static files from the root directory

const rooms = new Map();
const activeUsers = new Map();

io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);

    socket.on('createRoom', ({ roomId, username }) => {
        if (!rooms.has(roomId)) {
            rooms.set(roomId, {
                messages: [],
                users: new Set()
            });
            console.log(`Room created: ${roomId} by ${username}`);
        }

        const roomData = rooms.get(roomId);
        roomData.users.add(username);
        activeUsers.set(socket.id, { username, roomId });

        socket.join(roomId);
        socket.emit('roomCreated', { roomId });
        io.to(roomId).emit('updateUserCount', roomData.users.size);
    });

    socket.on('joinRoom', ({ roomId, username }) => {
        if (rooms.has(roomId)) {
            const roomData = rooms.get(roomId);
            roomData.users.add(username);
            activeUsers.set(socket.id, { username, roomId });

            socket.join(roomId);
            socket.emit('pastMessages', roomData.messages);

            io.to(roomId).emit('userJoined', {
                username,
                message: `${username} has joined the chat`,
                timestamp: new Date().toISOString()
            });
            io.to(roomId).emit('updateUserCount', roomData.users.size);
        } else {
            socket.emit('error', { message: 'Room does not exist' });
        }
    });

    socket.on('chatMessage', ({ message, roomId, replyTo }) => {
        const user = activeUsers.get(socket.id);
        if (user && rooms.has(roomId)) {
            const messageObj = {
                id: Date.now(),
                username: user.username,
                message,
                timestamp: new Date().toISOString(),
                replyTo
            };

            const roomData = rooms.get(roomId);
            roomData.messages.push(messageObj);

            io.to(roomId).emit('message', messageObj);
        }
    });

    socket.on('disconnect', () => {
        const user = activeUsers.get(socket.id);
        if (user) {
            const roomData = rooms.get(user.roomId);
            if (roomData) {
                roomData.users.delete(user.username);
                io.to(user.roomId).emit('updateUserCount', roomData.users.size);
                io.to(user.roomId).emit('userLeft', {
                    username: user.username,
                    message: `${user.username} has left the chat`,
                    timestamp: new Date().toISOString()
                });

                // Clean up empty rooms if needed
                if (roomData.users.size === 0) {
                    rooms.delete(user.roomId);
                    console.log(`Room ${user.roomId} deleted as it is empty`);
                }
            }
            activeUsers.delete(socket.id);
            console.log(`Client disconnected: ${socket.id}`);
        }
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
