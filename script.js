const socket = io();

let currentRoom = null;
let currentUsername = null;
let replyingTo = null;

// DOM Elements
const elements = {
    welcomeScreen: document.getElementById('welcome-screen'),
    inviteScreen: document.getElementById('invite-screen'),
    chatScreen: document.getElementById('chat-screen'),
    usernameInput: document.getElementById('username'),
    roomNameInput: document.getElementById('room-name'),
    createRoomBtn: document.getElementById('create-room-btn'),
    inviteLinkInput: document.getElementById('invite-link'),
    copyLinkBtn: document.getElementById('copy-link-btn'),
    enterRoomBtn: document.getElementById('enter-room-btn'),
    messagesContainer: document.getElementById('messages'),
    messageInput: document.getElementById('message-input'),
    sendBtn: document.getElementById('send-btn'),
    roomTitle: document.getElementById('room-title'),
    onlineCount: document.getElementById('online-count'),
    replyBar: document.getElementById('reply-bar'),
    replyText: document.getElementById('reply-text'),
    cancelReply: document.getElementById('cancel-reply'),
    roomInputWrapper: document.getElementById('room-input-wrapper'),
    joinInfo: document.getElementById('join-info'),
    imageInput: document.getElementById('image-input')
};

// Check for room invite link
window.addEventListener('load', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const roomId = urlParams.get('room');

    if (roomId) {
        currentRoom = roomId;
        elements.welcomeScreen.querySelector('h1').textContent = 'Join Room';
        elements.roomInputWrapper.style.display = 'none';
        elements.createRoomBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i><span>Join Room</span>';
        elements.joinInfo.textContent = "You're joining an existing room";
    }
});

// Event Listeners
elements.createRoomBtn.addEventListener('click', handleRoomAction);
elements.copyLinkBtn.addEventListener('click', copyInviteLink);
elements.enterRoomBtn.addEventListener('click', enterRoom);
elements.sendBtn.addEventListener('click', sendMessage);
elements.messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});
elements.cancelReply.addEventListener('click', cancelReply);
elements.imageInput.addEventListener('change', handleImageUpload);

// Room Functions
function handleRoomAction() {
    const username = elements.usernameInput.value.trim();
    const roomName = currentRoom || `${elements.roomNameInput.value.trim()}-${Date.now()}`;

    if (!username) {
        showNotification('Please enter your name');
        return;
    }

    currentUsername = username;

    if (currentRoom) {
        // Joining existing room
        socket.emit('joinRoom', { roomId: currentRoom, username });
        showScreen(elements.chatScreen);
        elements.roomTitle.textContent = 'Chat Room';
    } else {
        // Creating new room
        if (!elements.roomNameInput.value.trim()) {
            showNotification('Please enter a room name');
            return;
        }
        currentRoom = roomName;
        socket.emit('createRoom', { roomId: currentRoom, username });
        showScreen(elements.inviteScreen);
        elements.inviteLinkInput.value = `${window.location.origin}?room=${currentRoom}`;
    }
}

function copyInviteLink() {
    elements.inviteLinkInput.select();
    document.execCommand('copy');
    showNotification('Invite link copied!');
}

function enterRoom() {
    showScreen(elements.chatScreen);
    elements.roomTitle.textContent = elements.roomNameInput.value || 'Chat Room';
}

// Message Functions
function sendMessage() {
    const message = elements.messageInput.value.trim();
    if (!message) return;

    socket.emit('chatMessage', {
        message,
        roomId: currentRoom,
        replyTo: replyingTo
    });

    elements.messageInput.value = '';
    cancelReply();
}

function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        showNotification('Please select an image file');
        return;
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
        showNotification('Image size should be less than 5MB');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        socket.emit('chatMessage', {
            roomId: currentRoom,
            type: 'image',
            image: e.target.result,
            message: '📷 Image'
        });
    };
    reader.readAsDataURL(file);
}

function replyToMessage(message) {
    replyingTo = message;
    elements.replyBar.classList.remove('hidden');
    elements.replyText.textContent = `Replying to ${message.username}: ${message.message.substring(0, 30)}...`;
    elements.messageInput.focus();
}

function cancelReply() {
    replyingTo = null;
    elements.replyBar.classList.add('hidden');
    elements.replyText.textContent = '';
}

// UI Functions
function showScreen(screen) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    screen.classList.add('active');
}

function showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.classList.add('show');
    }, 100);

    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
}

function appendMessage(message) {
    const messageElement = document.createElement('div');
    messageElement.className = `message ${message.username === currentUsername ? 'sent' : 'received'}`;

    let content = '';
    if (message.replyTo) {
        content += `
            <div class="replied-message">
                <small>Replying to ${message.replyTo.username}</small>
                <p>${message.replyTo.message}</p>
            </div>
        `;
    }

    let messageContent = '';
    if (message.type === 'image') {
        messageContent = `<img src="${message.image}" class="message-image" onclick="viewImage('${message.image}')">`;
    } else {
        messageContent = `<div class="message-content">${message.message}</div>`;
    }

    // Append only one reply button depending on the device
    const isMobile = window.innerWidth <= 768;
    const replyButton = `
        <button class="reply-button" onclick='replyToMessage(${JSON.stringify(message)})'>
            <i class="fas fa-reply"></i> Reply
        </button>
    `;

    const mobileActions = `
        <div class="mobile-actions">
            ${replyButton}
        </div>
    `;

    messageElement.innerHTML = `
        <div class="message-bubble">
            <div class="message-header">
                <span class="username">${message.username}</span>
                <span class="timestamp">${new Date(message.timestamp).toLocaleTimeString()}</span>
            </div>
            ${content}
            ${messageContent}
            ${isMobile ? '' : replyButton}
        </div>
        ${isMobile ? mobileActions : ''}
    `;

    elements.messagesContainer.appendChild(messageElement);
    elements.messagesContainer.scrollTo({
        top: elements.messagesContainer.scrollHeight,
        behavior: 'smooth'
    });
}
function appendSystemMessage(data) {
    const messageElement = document.createElement('div');
    messageElement.className = 'system-message';
    messageElement.innerHTML = `
        <div class="system-message-content">
            <i class="fas fa-info-circle"></i>
            <span>${data.message}</span>
        </div>
    `;
    elements.messagesContainer.appendChild(messageElement);
    elements.messagesContainer.scrollTo({
        top: elements.messagesContainer.scrollHeight,
        behavior: 'smooth'
    });
}

function viewImage(src) {
    const viewer = document.createElement('div');
    viewer.className = 'image-viewer';
    viewer.innerHTML = `
        <div class="image-viewer-content">
            <img src="${src}">
            <button class="close-viewer">×</button>
        </div>
    `;
    document.body.appendChild(viewer);

    viewer.onclick = (e) => {
        if (e.target === viewer || e.target.className === 'close-viewer') {
            viewer.remove();
        }
    };
}

// Mobile Interactions
let touchTimer;
const touchDuration = 500;

function initializeMobileInteractions() {
    document.addEventListener('touchstart', handleTouchStart, false);
    document.addEventListener('touchend', handleTouchEnd, false);
}

function handleTouchStart(event) {
    if (!event.target.closest('.message-bubble')) return;

    touchTimer = setTimeout(() => {
        const message = event.target.closest('.message');
        if (message) {
            showMessageActions(message);
        }
    }, touchDuration);
}

function handleTouchEnd() {
    clearTimeout(touchTimer);
}

function showMessageActions(messageElement) {
    document.querySelectorAll('.message.show-actions').forEach(msg => {
        if (msg !== messageElement) {
            msg.classList.remove('show-actions');
        }
    });
    messageElement.classList.toggle('show-actions');
}

// Socket Events
socket.on('roomCreated', ({ roomId }) => {
    currentRoom = roomId;
});

socket.on('message', (message) => {
    appendMessage(message);
});

socket.on('userJoined', (data) => {
    appendSystemMessage(data);
});

socket.on('userLeft', (data) => {
    appendSystemMessage(data);
});

socket.on('updateUserCount', (count) => {
    elements.onlineCount.textContent = count;
});

socket.on('pastMessages', (messages) => {
    messages.forEach(message => appendMessage(message));
});

// Initialize
document.addEventListener('DOMContentLoaded', initializeMobileInteractions);

// Close mobile actions when clicking outside
document.addEventListener('click', (event) => {
    if (!event.target.closest('.message-bubble') && !event.target.closest('.mobile-actions')) {
        document.querySelectorAll('.message.show-actions').forEach(msg => {
            msg.classList.remove('show-actions');
        });
    }
});
