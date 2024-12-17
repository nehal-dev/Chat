const socket = io();

class ChatManager {
    constructor() {
        this.currentRoom = null;
        this.currentUsername = null;
        this.replyingTo = null;
        this.elements = {
            welcomeScreen: document.getElementById('welcomeScreen'),
            inviteScreen: document.getElementById('inviteScreen'),
            chatScreen: document.getElementById('chatRoom'),
            usernameInput: document.getElementById('username'),
            roomNameInput: document.getElementById('roomName'),
            createRoomBtn: document.getElementById('createRoomBtn'),
            inviteLinkInput: document.getElementById('inviteLink'),
            copyLinkBtn: document.getElementById('copyLinkBtn'),
            enterRoomBtn: document.getElementById('enterRoomBtn'),
            messagesContainer: document.getElementById('messageContainer'),
            messageInput: document.getElementById('messageInput'),
            currentRoomName: document.getElementById('currentRoomName'),
            currentRoomId: document.getElementById('currentRoomId'),
            onlineCount: document.getElementById('onlineCount'),
            replyPreview: document.getElementById('replyPreview'),
            replyText: document.getElementById('replyPreview .reply-content span'),
            cancelReply: document.querySelector('#replyPreview .cancel-reply'),
            imageUpload: document.getElementById('imageUpload'),
            imagePreviewModal: document.getElementById('imagePreviewModal'),
            previewImage: document.getElementById('previewImage'),
            closePreview: document.querySelector('#imagePreviewModal .close-preview')
        };

        this.initEventListeners();
        this.loadStoredMessages();
        this.initMobileInteractions();
    }

    initEventListeners() {
        this.elements.createRoomBtn.addEventListener('click', this.handleRoomAction.bind(this));
        this.elements.copyLinkBtn.addEventListener('click', this.copyInviteLink.bind(this));
        this.elements.enterRoomBtn.addEventListener('click', this.enterRoom.bind(this));
        this.elements.messageInput.addEventListener('keypress', this.handleMessageInput.bind(this));
        this.elements.cancelReply.addEventListener('click', this.cancelReply.bind(this));
        this.elements.imageUpload.addEventListener('change', this.handleImageUpload.bind(this));
        this.elements.closePreview.addEventListener('click', this.closeImagePreview.bind(this));
    }

    initMobileInteractions() {
        document.addEventListener('touchstart', this.handleTouchStart.bind(this), false);
        document.addEventListener('touchend', this.handleTouchEnd.bind(this), false);
        document.addEventListener('click', this.handleDocumentClick.bind(this));
    }

    handleRoomAction() {
        const username = this.elements.usernameInput.value.trim();
        const roomName = this.currentRoom || `${this.elements.roomNameInput.value.trim()}-${Date.now()}`;

        if (!username) {
            this.showNotification('Please enter your name');
            return;
        }

        this.currentUsername = username;

        if (this.currentRoom) {
            socket.emit('joinRoom', { roomId: this.currentRoom, username });
            this.showScreen(this.elements.chatScreen);
            this.elements.currentRoomName.textContent = 'Chat Room';
        } else {
            if (!this.elements.roomNameInput.value.trim()) {
                this.showNotification('Please enter a room name');
                return;
            }
            this.currentRoom = roomName;
            socket.emit('createRoom', { roomId: this.currentRoom, username });
            this.showScreen(this.elements.inviteScreen);
            this.elements.inviteLinkInput.value = `${window.location.origin}?room=${this.currentRoom}`;
        }
    }

    copyInviteLink() {
        this.elements.inviteLinkInput.select();
        document.execCommand('copy');
        this.showNotification('Invite link copied!');
    }

    enterRoom() {
        this.showScreen(this.elements.chatScreen);
        this.elements.currentRoomName.textContent = this.elements.roomNameInput.value || 'Chat Room';
        this.elements.currentRoomId.textContent = `Room ID: ${this.currentRoom}`;
    }

    handleMessageInput(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            this.sendMessage();
        }
    }

    sendMessage() {
        const message = this.elements.messageInput.value.trim();
        if (!message) return;

        const chatMessage = {
            message,
            roomId: this.currentRoom,
            replyTo: this.replyingTo,
            username: this.currentUsername,
            timestamp: Date.now()
        };

        socket.emit('chatMessage', chatMessage);
        this.storeChatMessage(chatMessage);
        this.elements.messageInput.value = '';
        this.cancelReply();
    }

    handleImageUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            this.showNotification('Please select an image file');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            this.showNotification('Image size should be less than 5MB');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const imageMessage = {
                roomId: this.currentRoom,
                type: 'image',
                image: e.target.result,
                message: '📷 Image',
                username: this.currentUsername,
                timestamp: Date.now()
            };
            
            socket.emit('chatMessage', imageMessage);
            this.storeChatMessage(imageMessage);
            this.appendMessage(imageMessage);
        };
        reader.readAsDataURL(file);
    }

    replyToMessage(message) {
        this.replyingTo = message;
        this.elements.replyPreview.classList.remove('hidden');
        this.elements.replyText.textContent = `Replying to ${message.username}: ${message.message.substring(0, 30)}...`;
        this.elements.messageInput.focus();
    }

    cancelReply() {
        this.replyingTo = null;
        this.elements.replyPreview.classList.add('hidden');
        this.elements.replyText.textContent = '';
    }

    showScreen(screen) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        screen.classList.add('active');
    }

    showNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'system-message';
        notification.textContent = message;
        this.elements.messagesContainer.appendChild(notification);

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

    appendMessage(message) {
        const messageElement = this.createMessageElement(message);
        this.elements.messagesContainer.appendChild(messageElement);
        this.elements.messagesContainer.scrollTo({
            top: this.elements.messagesContainer.scrollHeight,
            behavior: 'smooth'
        });
    }

    appendSystemMessage(data) {
        const messageElement = this.createSystemMessageElement(data.message);
        this.elements.messagesContainer.appendChild(messageElement);
        this.elements.messagesContainer.scrollTo({
            top: this.elements.messagesContainer.scrollHeight,
            behavior: 'smooth'
        });
    }

    createMessageElement(message) {
        const messageElement = document.createElement('div');
        messageElement.className = `message ${message.username === this.currentUsername ? 'sent' : 'received'}`;

        let content = '';
        if (message.replyTo) {
            content += `
                <div class="reply-container">
                    <i class="fas fa-reply"></i>
                    <span>${message.replyTo.username}: ${message.replyTo.message}</span>
                </div>
            `;
        }

        let messageContent = '';
        if (message.type === 'image') {
            messageContent = `<img src="${message.image}" class="message-image" onclick="viewImage('${message.image}')">`;
        } else {
            messageContent = `<div class="message-content">${message.message}</div>`;
        }

        messageElement.innerHTML = `
            <div class="message-header">
                <span class="username">${message.username}</span>
                <span class="timestamp">${new Date(message.timestamp).toLocaleTimeString()}</span>
            </div>
            ${content}
            ${messageContent}
            <button class="reply-btn" onclick='chatManager.replyToMessage(${JSON.stringify(message)})'>
                <i class="fas fa-reply"></i>
            </button>
        `;

        return messageElement;
    }

    createSystemMessageElement(message) {
        const messageElement = document.createElement('div');
        messageElement.className = 'system-message';
        messageElement.textContent = message;
        return messageElement;
    }

    viewImage(src) {
        this.elements.previewImage.src = src;
        this.elements.imagePreviewModal.classList.remove('hidden');
    }

    closeImagePreview() {
        this.elements.imagePreviewModal.classList.add('hidden');
    }

    handleTouchStart(event) {
        if (!event.target.closest('.message')) return;

        this.touchTimer = setTimeout(() => {
            const message = event.target.closest('.message');
            if (message) {
                this.showMessageActions(message);
            }
        }, 500);
    }

    handleTouchEnd() {
        clearTimeout(this.touchTimer);
    }

    handleDocumentClick(event) {
        if (!event.target.closest('.message') && !event.target.closest('.reply-btn')) {
            document.querySelectorAll('.message.show-actions').forEach(msg => {
                msg.classList.remove('show-actions');
            });
        }
    }

    showMessageActions(messageElement) {
        document.querySelectorAll('.message.show-actions').forEach(msg => {
            if (msg !== messageElement) {
                msg.classList.remove('show-actions');
            }
        });
        messageElement.classList.toggle('show-actions');
    }

    storeChatMessage(message) {
        const storedMessages = JSON.parse(localStorage.getItem(this.currentRoom)) || [];
        storedMessages.push(message);
        localStorage.setItem(this.currentRoom, JSON.stringify(storedMessages));
    }

    loadStoredMessages() {
        const storedMessages = JSON.parse(localStorage.getItem(this.currentRoom)) || [];
        storedMessages.forEach(message => this.appendMessage(message));
    }
}

const chatManager = new ChatManager();

socket.on('roomCreated', ({ roomId }) => {
    chatManager.currentRoom = roomId;
});

socket.on('message', (message) => {
    chatManager.appendMessage(message);
});

socket.on('userJoined', (data) => {
    chatManager.appendSystemMessage(data);
});

socket.on('userLeft', (data) => {
    chatManager.appendSystemMessage(data);
});

socket.on('updateUserCount', (count) => {
    chatManager.elements.onlineCount.textContent = count;
});

socket.on('pastMessages', (messages) => {
    messages.forEach(message => chatManager.appendMessage(message));
});
