const socket = io();

const createRoomSection = document.getElementById('create-room-section');
const joinRoomSection = document.getElementById('join-room-section');
const chatSection = document.getElementById('chat-section');
const roomUrlContainer = document.getElementById('room-url-container');
const roomUrlInput = document.getElementById('room-url');
const messageInput = document.getElementById('message-input');
const messagesContainer = document.getElementById('messages');
const roomTitle = document.getElementById('room-title');

let currentRoom = null;
let currentUsername = null;

// Create Room
document.getElementById('create-btn').addEventListener('click', () => {
    const username = document.getElementById('username').value.trim();
    const roomName = document.getElementById('room-name').value.trim();

    if (username && roomName) {
        currentUsername = username;
        const roomId = generateRoomId();
        socket.emit('create-room', { roomId, username });
    }
});

// Copy URL
document.getElementById('copy-url').addEventListener('click', () => {
    roomUrlInput.select();
    document.execCommand('copy');
    showNotification('URL copied to clipboard!');
});

// Enter Room
document.getElementById('enter-room').addEventListener('click', () => {
    enterRoom(currentRoom, currentUsername);
});

// Join Room
document.getElementById('join-btn').addEventListener('click', () => {
    const username = document.getElementById('join-username').value.trim();
    const urlParams = new URLSearchParams(window.location.search);
    const roomId = urlParams.get('room');

    if (username && roomId) {
        currentUsername = username;
        socket.emit('join-room', { roomId, username });
    }
});

// Send Message
document.getElementById('send-btn').addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

// Socket Events
socket.on('room-created', (roomId) => {
    currentRoom = roomId;
    const roomUrl = `${window.location.origin}?room=${roomId}`;
    roomUrlInput.value = roomUrl;
    roomUrlContainer.classList.remove('hidden');
});

socket.on('room-joined', (roomId) => {
    enterRoom(roomId, currentUsername);
});

socket.on('user-joined', (username) => {
    addSystemMessage(`${username} has joined the room`);
});

socket.on('message', (data) => {
    addMessage(data.username, data.message, data.username === currentUsername);
});

// Helper Functions
function generateRoomId() {
    return Math.random().toString(36).substring(2, 15);
}

function enterRoom(roomId, username) {
    currentRoom = roomId;
    createRoomSection.classList.remove('active');
    joinRoomSection.classList.remove('active');
    chatSection.classList.add('active');
    roomTitle.textContent = `Chat Room: ${roomId}`;
}

function sendMessage() {
    const message = messageInput.value.trim();
    if (message && currentRoom) {
        socket.emit('chat-message', {
            roomId: currentRoom,
            message,
            username: currentUsername
        });
        messageInput.value = '';
    }
}

function addMessage(username, message, isSent) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', isSent ? 'sent' : 'received');
    messageElement.innerHTML = `
        <strong>${username}:</strong><br>
        ${message}
    `;
    messagesContainer.appendChild(messageElement);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function addSystemMessage(message) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('system-message');
    messageElement.textContent = message;
    messagesContainer.appendChild(messageElement);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function showNotification(message) {
    const notification = document.createElement('div');
    notification.classList.add('notification');
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
}

// Check URL for room parameter
window.addEventListener('load', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const roomId = urlParams.get('room');
    
    if (roomId) {
        createRoomSection.classList.remove('active');
        joinRoomSection.classList.add('active');
    }
});
