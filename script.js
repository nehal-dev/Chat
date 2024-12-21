const socket = io();
const state = {
    currentRoom: null,
    currentUsername: null,
    replyingTo: null,
    typingTimeout: null,
    mediaGallery: [],
    isTyping: false,
    unreadMessages: 0,
    roomMembers: new Set(),
    sharedMedia: new Map()
};

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
    roomTitle: document.getElementById('room-title'),
    onlineCount: document.getElementById('online-count'),
    replyBar: document.getElementById('reply-bar'),
    replyText: document.getElementById('reply-text'),
    cancelReply: document.getElementById('cancel-reply'),
    imageInput: document.getElementById('image-input'),
    loadingIndicator: document.getElementById('loading-indicator'),
    sendMessageBtn: document.getElementById('send-message-btn'),
    typingIndicator: document.getElementById('typing-indicator')
};

window.addEventListener('load', () => {
    const savedSession = localStorage.getItem('chatSession');
    if (savedSession) {
        const session = JSON.parse(savedSession);
        state.currentUsername = session.username;
        elements.usernameInput.value = session.username;
    }
    const urlParams = new URLSearchParams(window.location.search);
    const roomId = urlParams.get('room');
    if (roomId) handleJoinViaLink(roomId);
});

elements.createRoomBtn.addEventListener('click', () => {
    const username = elements.usernameInput.value.trim();
    const roomName = elements.roomNameInput.value.trim();
    if (!username || !roomName) {
        showNotification('Please fill in all fields');
        return;
    }
    state.currentRoom = `${roomName}-${Date.now()}`;
    state.currentUsername = username;
    socket.emit('createRoom', { username, roomName, roomId: state.currentRoom });
    localStorage.setItem('chatSession', JSON.stringify({ username, roomId: state.currentRoom }));
    showInviteScreen();
});

elements.copyLinkBtn.addEventListener('click', async () => {
    try {
        await navigator.clipboard.writeText(elements.inviteLinkInput.value);
        showNotification('Link copied!');
    } catch (err) {
        elements.inviteLinkInput.select();
        document.execCommand('copy');
    }
});

elements.enterRoomBtn.addEventListener('click', () => {
    elements.inviteScreen.classList.remove('active');
    elements.chatScreen.classList.add('active');
    socket.emit('joinRoom', { 
        username: state.currentUsername, 
        roomId: state.currentRoom 
    });
});

elements.messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

elements.messageInput.addEventListener('input', () => {
    if (!state.isTyping) {
        state.isTyping = true;
        socket.emit('typing', { 
            username: state.currentUsername, 
            roomId: state.currentRoom 
        });
    }
    clearTimeout(state.typingTimeout);
    state.typingTimeout = setTimeout(() => {
        state.isTyping = false;
        socket.emit('stopTyping', { 
            username: state.currentUsername, 
            roomId: state.currentRoom 
        });
    }, 1000);
});

elements.imageInput.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    for (const file of files) {
        if (file.size > 5242880) {
            showNotification('Image must be less than 5MB');
            continue;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            socket.emit('imageMessage', {
                username: state.currentUsername,
                roomId: state.currentRoom,
                image: e.target.result,
                timestamp: new Date().toISOString(),
                replyTo: state.replyingTo
            });
        };
        reader.readAsDataURL(file);
    }
    e.target.value = '';
});

function sendMessage() {
    const message = elements.messageInput.value.trim();
    if (!message) return;
    socket.emit('chatMessage', {
        username: state.currentUsername,
        roomId: state.currentRoom,
        message,
        timestamp: new Date().toISOString(),
        replyTo: state.replyingTo
    });
    elements.messageInput.value = '';
    state.replyingTo = null;
    elements.replyBar.classList.add('hidden');
}

function appendMessage(data) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${data.username === state.currentUsername ? 'sent' : 'received'}`;
    
    if (data.replyTo) {
        const replyDiv = document.createElement('div');
        replyDiv.className = 'reply-content';
        replyDiv.textContent = `↪ ${data.replyTo.username}: ${data.replyTo.message || 'Image'}`;
        messageDiv.appendChild(replyDiv);
    }

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    if (data.image) {
        const img = document.createElement('img');
        img.src = data.image;
        img.className = 'message-image';
        img.onclick = () => showImagePreview(data.image);
        contentDiv.appendChild(img);
    } else {
        contentDiv.textContent = data.message;
    }

    const timeSpan = document.createElement('span');
    timeSpan.className = 'message-time';
    timeSpan.textContent = new Date(data.timestamp).toLocaleTimeString();
    
    messageDiv.appendChild(contentDiv);
    messageDiv.appendChild(timeSpan);
    elements.messagesContainer.appendChild(messageDiv);
    elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;
}

function showImagePreview(src) {
    const modal = document.createElement('div');
    modal.className = 'image-preview-modal';
    modal.innerHTML = `
        <div class="modal-content">
            <span class="close">&times;</span>
            <img src="${src}">
        </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector('.close').onclick = () => modal.remove();
    modal.onclick = (e) => {
        if (e.target === modal) modal.remove();
    };
}

function showNotification(message) {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.classList.add('show');
    setTimeout(() => notification.classList.remove('show'), 3000);
}

function handleJoinViaLink(roomId) {
    state.currentRoom = roomId;
    elements.welcomeScreen.classList.remove('active');
    elements.chatScreen.classList.add('active');
}

socket.on('message', appendMessage);
socket.on('imageMessage', appendMessage);
socket.on('typing', (data) => {
    if (data.username !== state.currentUsername) {
        elements.typingIndicator.textContent = `${data.username} is typing...`;
        elements.typingIndicator.classList.remove('hidden');
    }
});
socket.on('stopTyping', () => {
    elements.typingIndicator.classList.add('hidden');
});
socket.on('userJoined', (data) => {
    showNotification(`${data.username} joined the room`);
    elements.onlineCount.textContent = data.onlineCount;
});
socket.on('userLeft', (data) => {
    showNotification(`${data.username} left the room`);
    elements.onlineCount.textContent = data.onlineCount;
});
