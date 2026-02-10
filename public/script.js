const chatHistory = document.getElementById('chat-history');
const chatForm = document.getElementById('chat-form');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const authModal = document.getElementById('auth-modal');
const authForm = document.getElementById('auth-form');
const authTitle = document.getElementById('auth-title');
const authSubmitBtn = document.getElementById('auth-submit-btn');
const authSwitchText = document.getElementById('auth-switch-text');
const authSwitchBtn = document.getElementById('auth-switch-btn');
const authError = document.getElementById('auth-error');
const logoutBtn = document.getElementById('logout-btn');
const chatInterface = document.getElementById('chat-interface');
const sidebar = document.getElementById('sidebar');
const contactsList = document.getElementById('contacts-list');
const groupsList = document.getElementById('groups-list');
const currentChatName = document.getElementById('current-chat-name');
const mobileMenuBtn = document.getElementById('mobile-menu-btn');
const currentUserAvatar = document.getElementById('current-user-avatar');
const currentUsernameDisplay = document.getElementById('current-username');

// Group Modal Elements
const createGroupBtn = document.getElementById('create-group-btn');
const groupModal = document.getElementById('group-modal');
const createGroupForm = document.getElementById('create-group-form');
const cancelGroupBtn = document.getElementById('cancel-group-btn');
const userChecklist = document.getElementById('user-checklist');

let isLoginMode = true;
let authToken = localStorage.getItem('authToken');
let currentUsername = localStorage.getItem('username');
let currentUserId = localStorage.getItem('userId');
let activeContactId = 'ai-agent'; // 'ai-agent', userId, or groupId
let activeType = 'ai'; // 'ai', 'user', 'group'
let pollingInterval;

// --- Auth Functions ---

function toggleAuthMode() {
    isLoginMode = !isLoginMode;
    if (isLoginMode) {
        authTitle.textContent = 'Login';
        authSubmitBtn.textContent = 'Login';
        authSwitchText.textContent = "Don't have an account?";
        authSwitchBtn.textContent = 'Register';
    } else {
        authTitle.textContent = 'Register';
        authSubmitBtn.textContent = 'Register';
        authSwitchText.textContent = "Already have an account?";
        authSwitchBtn.textContent = 'Login';
    }
    authError.textContent = '';
}

function checkAuth() {
    authToken = localStorage.getItem('authToken');
    currentUsername = localStorage.getItem('username');
    currentUserId = localStorage.getItem('userId');

    if (authToken) {
        if (!currentUserId) {
            // Force re-login if userId is missing (legacy session)
            logout();
            return;
        }

        authModal.classList.add('hidden');
        chatInterface.classList.remove('hidden');
        sidebar.classList.remove('hidden');

        if (currentUsername) {
            currentUsernameDisplay.textContent = currentUsername;
            currentUserAvatar.textContent = currentUsername.charAt(0).toUpperCase();
        }

        loadContacts();
        loadGroups();
        loadChat(activeContactId, activeType);
        startPolling();
    } else {
        authModal.classList.remove('hidden');
        chatInterface.classList.add('hidden');
        sidebar.classList.add('hidden');
        stopPolling();
    }
}

function logout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('username');
    localStorage.removeItem('userId');
    authToken = null;
    currentUsername = null;
    currentUserId = null;
    checkAuth();
}

// --- Contact & Group Functions ---

async function loadContacts() {
    try {
        const res = await fetch('/api/users', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const users = await res.json();

        // Clear existing users (keep AI Agent)
        const aiAgent = contactsList.querySelector('[data-id="ai-agent"]');
        contactsList.innerHTML = '';
        contactsList.appendChild(aiAgent);

        users.forEach(user => {
            const div = document.createElement('div');
            div.className = `contact-item ${activeContactId === user._id ? 'active' : ''}`;
            div.dataset.id = user._id;
            div.dataset.type = 'user';
            div.innerHTML = `
                <div class="avatar">${user.username.charAt(0).toUpperCase()}</div>
                <div class="contact-info">
                    <span class="contact-name">${user.username}</span>
                    <span class="contact-status">User</span>
                </div>
            `;
            div.addEventListener('click', () => switchChat(user._id, user.username, 'user'));
            contactsList.appendChild(div);
        });

        // Re-attach AI Agent listener
        aiAgent.onclick = () => switchChat('ai-agent', 'AI Assistant', 'ai');

    } catch (error) {
        console.error('Failed to load contacts:', error);
    }
}

async function loadGroups() {
    try {
        const res = await fetch('/api/groups', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const groups = await res.json();

        groupsList.innerHTML = '';

        groups.forEach(group => {
            const div = document.createElement('div');
            div.className = `contact-item ${activeContactId === group._id ? 'active' : ''}`;
            div.dataset.id = group._id;
            div.dataset.type = 'group';
            div.innerHTML = `
                <div class="avatar group-avatar">${group.name.charAt(0).toUpperCase()}</div>
                <div class="contact-info">
                    <span class="contact-name">${group.name}</span>
                    <span class="contact-status">${group.members.length} members</span>
                </div>
            `;
            div.addEventListener('click', () => switchChat(group._id, group.name, 'group'));
            groupsList.appendChild(div);
        });
    } catch (error) {
        console.error('Failed to load groups:', error);
    }
}

function switchChat(id, name, type) {
    activeContactId = id;
    activeType = type;
    currentChatName.textContent = name;

    // Update active class
    document.querySelectorAll('.contact-item').forEach(el => el.classList.remove('active'));

    // Find based on ID and update active state
    const selector = type === 'ai' ? '[data-id="ai-agent"]' : `[data-id="${id}"]`;
    document.querySelector(selector)?.classList.add('active');

    // Close mobile sidebar
    sidebar.classList.remove('open');

    loadChat(id, type);
}

async function loadChat(id, type) {
    chatHistory.innerHTML = '';

    if (type === 'ai') {
        loadAiHistory();
    } else if (type === 'user') {
        loadUserHistory(id);
    } else if (type === 'group') {
        loadGroupHistory(id);
    }
}

async function loadAiHistory() {
    try {
        const res = await fetch('/api/history', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const history = await res.json();

        if (history.length === 0) {
            showWelcomeMessage();
        } else {
            history.forEach(msg => {
                appendMessage(msg.input, 'user');
                appendMessage(msg.output, 'ai');
            });
            scrollToBottom();
        }
    } catch (error) {
        console.error('Failed to load AI history:', error);
    }
}

async function loadUserHistory(otherUserId) {
    try {
        const res = await fetch(`/api/messages/${otherUserId}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const messages = await res.json();

        if (messages.length === 0) {
            chatHistory.innerHTML = '<div class="welcome-message"><p>No messages yet. Say hello! 👋</p></div>';
        } else {
            messages.forEach(msg => {
                const isMe = msg.senderId === currentUserId;
                appendMessage(msg.content, isMe ? 'user' : 'ai');
            });
            scrollToBottom();
        }
    } catch (error) {
        console.error('Failed to load messages:', error);
    }
}

async function loadGroupHistory(groupId) {
    try {
        const res = await fetch(`/api/groups/${groupId}/messages`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const messages = await res.json();

        if (messages.length === 0) {
            chatHistory.innerHTML = '<div class="welcome-message"><p>Welcome to the group! 👋</p></div>';
        } else {
            messages.forEach(msg => {
                const isMe = msg.senderId === currentUserId;
                appendMessage(msg.content, isMe ? 'user' : 'ai', isMe ? null : msg.senderName);
            });
            scrollToBottom();
        }
    } catch (error) {
        console.error('Failed to load group messages:', error);
    }
}

function appendMessage(text, type, senderName = null) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${type}`;

    if (senderName) {
        const senderSpan = document.createElement('span');
        senderSpan.className = 'message-sender';
        senderSpan.textContent = senderName;
        msgDiv.appendChild(senderSpan);
    }

    const textNode = document.createTextNode(text);
    msgDiv.appendChild(textNode);

    chatHistory.appendChild(msgDiv);
    scrollToBottom();
}

function showWelcomeMessage() {
    chatHistory.innerHTML = `
        <div class="welcome-message">
            <h2>Hello! 👋</h2>
            <p>I am your AI assistant. How can I help you today?</p>
        </div>
    `;
}

function scrollToBottom() {
    chatHistory.scrollTop = chatHistory.scrollHeight;
}

// --- Group Creation ---

async function openCreateGroupModal() {
    try {
        const res = await fetch('/api/users', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const users = await res.json();

        userChecklist.innerHTML = '';
        users.forEach(user => {
            const div = document.createElement('div');
            div.className = 'checklist-item';
            div.innerHTML = `
                <input type="checkbox" id="user-${user._id}" value="${user._id}">
                <label for="user-${user._id}">${user.username}</label>
            `;
            userChecklist.appendChild(div);
        });

        groupModal.classList.remove('hidden');
    } catch (error) {
        console.error('Failed to load users for group creation:', error);
    }
}

createGroupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('group-name').value;
    const checkboxes = userChecklist.querySelectorAll('input[type="checkbox"]:checked');
    const memberIds = Array.from(checkboxes).map(cb => cb.value);

    if (memberIds.length === 0) {
        alert('Please select at least one member');
        return;
    }

    try {
        const res = await fetch('/api/groups', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ name, members: memberIds })
        });

        if (res.ok) {
            groupModal.classList.add('hidden');
            loadGroups();
            document.getElementById('group-name').value = '';
        } else {
            alert('Failed to create group');
        }
    } catch (error) {
        console.error('Error creating group:', error);
    }
});

// --- Polling ---

function startPolling() {
    if (pollingInterval) clearInterval(pollingInterval);
    pollingInterval = setInterval(() => {
        if (!document.hidden) {
            refreshChat();
            // Also refresh lists occasionally? For now just chat.
            // But if we want to see new groups, we should poll groups too.
            // Let's do it less frequently or just separate? 
            // For simplicity, let's just refresh current chat.
        }
    }, 3000);
}

function stopPolling() {
    if (pollingInterval) clearInterval(pollingInterval);
}

async function refreshChat() {
    if (activeType === 'ai') return;

    try {
        let endpoint = '';
        if (activeType === 'user') endpoint = `/api/messages/${activeContactId}`;
        if (activeType === 'group') endpoint = `/api/groups/${activeContactId}/messages`;

        const res = await fetch(endpoint, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const messages = await res.json();

        const currentCount = chatHistory.querySelectorAll('.message').length;
        if (messages.length !== currentCount) {
            chatHistory.innerHTML = '';
            messages.forEach(msg => {
                const isMe = msg.senderId === currentUserId;
                // For group, we need senderName. For user, we don't really.
                // But loadGroupHistory handles it. Let's just re-call load logic?
                // Re-calling load logic is easier but flickery. 
                // Let's duplicate the render logic slightly to be safe.

                if (activeType === 'group') {
                    appendMessage(msg.content, isMe ? 'user' : 'ai', isMe ? null : msg.senderName);
                } else {
                    appendMessage(msg.content, isMe ? 'user' : 'ai');
                }
            });
            scrollToBottom();
        }
    } catch (error) {
        console.error('Polling error:', error);
    }
}

// --- Event Listeners ---

authSwitchBtn.addEventListener('click', (e) => {
    e.preventDefault();
    toggleAuthMode();
});

logoutBtn.addEventListener('click', logout);

mobileMenuBtn.addEventListener('click', () => {
    sidebar.classList.toggle('open');
});

createGroupBtn.addEventListener('click', openCreateGroupModal);

cancelGroupBtn.addEventListener('click', () => {
    groupModal.classList.add('hidden');
});

authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    authError.textContent = '';

    if (!username || !password) return;

    const endpoint = isLoginMode ? '/api/auth/login' : '/api/auth/register';

    try {
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await res.json();

        if (!res.ok) throw new Error(data.error || 'Authentication failed');

        if (isLoginMode) {
            authToken = data.token;
            currentUsername = data.username;
            currentUserId = data.userId;

            localStorage.setItem('authToken', authToken);
            localStorage.setItem('username', currentUsername);
            localStorage.setItem('userId', currentUserId);

            checkAuth();
        } else {
            toggleAuthMode();
            authError.style.color = '#10b981';
            authError.textContent = 'Registration successful! Please login.';
        }
    } catch (error) {
        authError.style.color = '#ef4444';
        authError.textContent = error.message;
    }
});

chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!authToken) return;

    const message = userInput.value.trim();
    if (!message) return;

    appendMessage(message, 'user');
    userInput.value = '';

    if (activeType === 'ai') {
        await sendToAi(message);
    } else if (activeType === 'user') {
        await sendToUser(activeContactId, message);
    } else if (activeType === 'group') {
        await sendToGroup(activeContactId, message);
    }
});

async function sendToAi(message) {
    sendBtn.disabled = true;

    const typingDiv = document.createElement('div');
    typingDiv.className = 'typing-indicator';
    typingDiv.innerHTML = '<span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>';
    chatHistory.appendChild(typingDiv);
    scrollToBottom();

    try {
        const res = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ message })
        });

        // 1. Check for HTTP errors (like 401, 403, 500)
        if (!res.ok) {
            // Try to read error text (it might not be JSON)
            const errorText = await res.text();
            throw new Error(`Server Error ${res.status}: ${errorText || res.statusText}`);
        }

        // 2. Parsed JSON
        const data = await res.json();
        typingDiv.remove();

        if (data.response) {
            appendMessage(data.response, 'ai');
        } else {
            appendMessage("Something went wrong.", 'ai');
        }
    } catch (error) {
        console.error('SendToAi Error:', error);
        typingDiv.remove();
        // Show the ACTUAL error in the chat
        appendMessage(`Connection Error: ${error.message}`, 'ai');

        // If 401/403, force logout prompt
        if (error.message.includes('401') || error.message.includes('403')) {
            setTimeout(() => {
                alert("Session expired or invalid. Please login again.");
                logout();
            }, 2000);
        }
    } finally {
        sendBtn.disabled = false;
        userInput.focus();
    }
}

async function sendToUser(recipientId, content) {
    try {
        await fetch('/api/messages/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ recipientId, content })
        });
    } catch (error) {
        console.error('Failed to send message:', error);
        appendMessage("Failed to send message.", 'ai');
    }
}

async function sendToGroup(groupId, content) {
    try {
        await fetch(`/api/groups/${groupId}/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ content })
        });
    } catch (error) {
        console.error('Failed to send group message:', error);
        appendMessage("Failed to send message.", 'ai');
    }
}

// --- Notes Functions ---

const notesList = document.getElementById('notes-list');
const addNoteBtn = document.getElementById('add-note-btn');
const noteModal = document.getElementById('note-modal');
const noteModalTitle = document.getElementById('note-modal-title');
const createNoteForm = document.getElementById('create-note-form');
const noteTitleInput = document.getElementById('note-title');
const noteContentInput = document.getElementById('note-content');
const noteIdInput = document.getElementById('note-id');
const cancelNoteBtn = document.getElementById('cancel-note-btn');

async function loadNotes() {
    try {
        const res = await fetch('/api/notes', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const notes = await res.json();

        notesList.innerHTML = '';

        notes.forEach(note => {
            const div = document.createElement('div');
            div.className = 'contact-item note-item';
            div.dataset.id = note.id;

            // Truncate long content for preview
            const preview = note.content.length > 40 ? note.content.substring(0, 40) + '...' : note.content;

            div.innerHTML = `
                <div class="contact-info note-info">
                    <span class="contact-name">${note.title || 'Untitled Note'}</span>
                    <span class="contact-status" style="font-size: 0.75rem; opacity: 0.7;">${preview}</span>
                </div>
                <button class="delete-note-btn" onclick="deleteNote('${note.id}', event)">×</button>
            `;

            // Click to Edit/View
            div.onclick = (e) => {
                if (e.target.classList.contains('delete-note-btn')) return;
                openNoteModal(note);
            };
            notesList.appendChild(div);
        });
    } catch (error) {
        console.error('Failed to load notes:', error);
    }
}

function openNoteModal(note = null) {
    if (note) {
        // Edit Mode
        noteModalTitle.textContent = "Edit Note";
        noteIdInput.value = note.id;
        noteTitleInput.value = note.title || "";
        noteContentInput.value = note.content;
    } else {
        // Create Mode
        noteModalTitle.textContent = "Create New Note";
        noteIdInput.value = "";
        noteTitleInput.value = "";
        noteContentInput.value = "";
    }
    noteModal.classList.remove('hidden');
    // Focus title if empty, otherwise content
    if (!noteTitleInput.value) {
        noteTitleInput.focus();
    } else {
        noteContentInput.focus();
    }
}

async function saveNoteHandler() {
    const title = noteTitleInput.value.trim();
    const content = noteContentInput.value.trim();
    const noteId = noteIdInput.value;

    if (!content) return;

    try {
        let url = '/api/notes';
        let method = 'POST';
        let body = { title, content };

        if (noteId) {
            url = `/api/notes/${noteId}`;
            method = 'PUT';
        }

        const res = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(body)
        });

        if (res.ok) {
            noteModal.classList.add('hidden');
            loadNotes();
        } else {
            alert('Failed to save note');
        }
    } catch (error) {
        console.error('Error saving note:', error);
    }
}

async function deleteNote(noteId, event) {
    if (event) event.stopPropagation();
    if (!confirm('Delete this note?')) return;

    try {
        const res = await fetch(`/api/notes/${noteId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (res.ok) {
            loadNotes();
        } else {
            alert('Failed to delete note');
        }
    } catch (error) {
        console.error('Error deleting note:', error);
    }
}

// --- Notes Event Listeners ---

addNoteBtn.addEventListener('click', () => {
    openNoteModal(null);
});

cancelNoteBtn.addEventListener('click', () => {
    noteModal.classList.add('hidden');
});

createNoteForm.addEventListener('submit', (e) => {
    e.preventDefault();
    saveNoteHandler();
});

// Update checkAuth to load notes
const originalCheckAuth = checkAuth;
checkAuth = function () {
    originalCheckAuth(); // Call original
    if (authToken) {
        loadNotes();
    }
};

// Initial Check (Redo to capture new checkAuth)
checkAuth();

// Expose deleteNote to global scope for onclick handler
window.deleteNote = deleteNote;
