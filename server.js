const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');
const { v4: uuidv4 } = require('uuid');

app.use(express.static(path.join(__dirname)));
app.use(express.json({ limit: '50mb' }));

const rooms = new Map();
const activeUsers = new Map();
const userTypingStatus = new Map();

const messageLimit = 100;
const imageSizeLimit = 5242880; // 5MB

function cleanOldMessages(roomId) {
    const room = rooms.get(roomId);
    if (room && room.messages.length > messageLimit) {
        room.messages = room.messages.slice(-messageLimit);
    }
}

function createRoomData() {
    return {
        messages: [],
        users: new Set(),
        images: [],
        createdAt: new Date().toISOString()
    };
}

io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);

    socket.on('createRoom', ({ roomId, username, roomName }) => {
        const newRoomId = roomId || uuidv4();
        if (!rooms.has(newRoomId)) {
            rooms.set(newRoomId, createRoomData());
        }

        const roomData = rooms.get(newRoomId);
        roomData.users.add(username);
        roomData.roomName = roomName;
        activeUsers.set(socket.id, { username, roomId: newRoomId });

        socket.join(newRoomId);
        socket.emit('roomCreated', { 
            roomId: newRoomId,
            roomName,
            onlineCount: roomData.users.size
        });
        io.to(newRoomId).emit('updateUserCount', roomData.users.size);
    });

    socket.on('joinRoom', ({ roomId, username }) => {
        if (!rooms.has(roomId)) {
            socket.emit('error', { message: 'Room not found' });
            return;
        }

        const roomData = rooms.get(roomId);
        roomData.users.add(username);
        activeUsers.set(socket.id, { username, roomId });

        socket.join(roomId);
        socket.emit('pastMessages', roomData.messages);
        
        io.to(roomId).emit('userJoined', {
            username,
            message: `${username} has joined the chat`,
            timestamp: new Date().toISOString(),
            onlineCount: roomData.users.size
        });
    });

    socket.on('chatMessage', (data) => {
        const user = activeUsers.get(socket.id);
        if (!user || !rooms.has(data.roomId)) return;

        const messageObj = {
            id: uuidv4(),
            username: user.username,
            message: data.message,
            timestamp: new Date().toISOString(),
            replyTo: data.replyTo,
            type: 'text'
        };

        const roomData = rooms.get(data.roomId);
        roomData.messages.push(messageObj);
        cleanOldMessages(data.roomId);

        io.to(data.roomId).emit('message', messageObj);
    });

    socket.on('imageMessage', async (data) => {
        const user = activeUsers.get(socket.id);
        if (!user || !rooms.has(data.roomId)) return;

        if (data.image.length > imageSizeLimit) {
            socket.emit('error', { message: 'Image size exceeds limit' });
            return;
        }

        const imageObj = {
            id: uuidv4(),
            username: user.username,
            image: data.image,
            timestamp: new Date().toISOString(),
            replyTo: data.replyTo,
            type: 'image'
        };

        const roomData = rooms.get(data.roomId);
        roomData.messages.push(imageObj);
        roomData.images.push(imageObj);
        cleanOldMessages(data.roomId);

        io.to(data.roomId).emit('message', imageObj);
    });

    socket.on('typing', (data) => {
        const user = activeUsers.get(socket.id);
        if (!user) return;

        userTypingStatus.set(socket.id, true);
        socket.to(data.roomId).emit('typing', {
            username: user.username
        });
    });

    socket.on('stopTyping', (data) => {
        const user = activeUsers.get(socket.id);
        if (!user) return;

        userTypingStatus.delete(socket.id);
        socket.to(data.roomId).emit('stopTyping', {
            username: user.username
        });
    });

    socket.on('reconnect', ({ roomId, username }) => {
        if (rooms.has(roomId)) {
            const roomData = rooms.get(roomId);
            socket.join(roomId);
            activeUsers.set(socket.id, { username, roomId });
            socket.emit('pastMessages', roomData.messages);
            io.to(roomId).emit('updateUserCount', roomData.users.size);
        }
    });

    socket.on('disconnect', () => {
        const user = activeUsers.get(socket.id);
        if (!user) return;

        const roomData = rooms.get(user.roomId);
        if (roomData) {
            roomData.users.delete(user.username);
            userTypingStatus.delete(socket.id);

            io.to(user.roomId).emit('userLeft', {
                username: user.username,
                message: `${user.username} has left the chat`,
                timestamp: new Date().toISOString(),
                onlineCount: roomData.users.size
            });

            if (roomData.users.size === 0) {
                setTimeout(() => {
                    if (roomData.users.size === 0) {
                        rooms.delete(user.roomId);
                        console.log(`Room ${user.roomId} deleted due to inactivity`);
                    }
                }, 3600000); // Clean up after 1 hour of inactivity
            }
        }
        activeUsers.delete(socket.id);
    });
});

// Error handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

// Periodic cleanup of inactive rooms
setInterval(() => {
    const oneHourAgo = new Date(Date.now() - 3600000);
    rooms.forEach((data, roomId) => {
        if (data.users.size === 0 && new Date(data.createdAt) < oneHourAgo) {
            rooms.delete(roomId);
            console.log(`Cleaned up inactive room: ${roomId}`);
        }
    });
}, 3600000);

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
