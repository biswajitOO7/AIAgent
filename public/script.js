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
const currentChatName = document.getElementById('current-chat-name');
const mobileMenuBtn = document.getElementById('mobile-menu-btn');
const currentUserAvatar = document.getElementById('current-user-avatar');
const currentUsernameDisplay = document.getElementById('current-username');

let isLoginMode = true;
let authToken = localStorage.getItem('authToken');
let currentUsername = localStorage.getItem('username');
let currentUserId = localStorage.getItem('userId');
let activeContactId = 'ai-agent'; // 'ai-agent' or userId
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
    if (authToken) {
        authModal.classList.add('hidden');
        chatInterface.classList.remove('hidden');
        sidebar.classList.remove('hidden');

        if (currentUsername) {
            currentUsernameDisplay.textContent = currentUsername;
            currentUserAvatar.textContent = currentUsername.charAt(0).toUpperCase();
        }

        loadContacts();
        loadChat(activeContactId);
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

// --- Contact & Chat Functions ---

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
            div.dataset.name = user.username;
            div.innerHTML = `
                <div class="avatar">${user.username.charAt(0).toUpperCase()}</div>
                <div class="contact-info">
                    <span class="contact-name">${user.username}</span>
                    <span class="contact-status">User</span>
                </div>
            `;
            div.addEventListener('click', () => switchContact(user._id, user.username));
            contactsList.appendChild(div);
        });

        // Re-attach AI Agent listener
        aiAgent.onclick = () => switchContact('ai-agent', 'AI Assistant');

    } catch (error) {
        console.error('Failed to load contacts:', error);
    }
}

function switchContact(contactId, contactName) {
    activeContactId = contactId;
    currentChatName.textContent = contactName;

    // Update active class
    document.querySelectorAll('.contact-item').forEach(el => el.classList.remove('active'));
    document.querySelector(`[data-id="${contactId}"]`)?.classList.add('active');

    // Close mobile sidebar
    sidebar.classList.remove('open');

    loadChat(contactId);
}

async function loadChat(contactId) {
    chatHistory.innerHTML = '';

    if (contactId === 'ai-agent') {
        loadAiHistory();
    } else {
        loadUserHistory(contactId);
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
                appendMessage(msg.content, isMe ? 'user' : 'ai'); // Reusing 'ai' class for 'other user' style
            });
            scrollToBottom();
        }
    } catch (error) {
        console.error('Failed to load messages:', error);
    }
}

function appendMessage(text, type) {
    const msgDiv = document.createElement('div');
    // type: 'user' (me) or 'ai' (other/bot)
    msgDiv.className = `message ${type}`;
    msgDiv.textContent = text;
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

// --- Polling ---

function startPolling() {
    if (pollingInterval) clearInterval(pollingInterval);
    pollingInterval = setInterval(() => {
        if (!document.hidden && activeContactId !== 'ai-agent') {
            refreshUserChat();
        }
    }, 3000); // Poll every 3 seconds
}

function stopPolling() {
    if (pollingInterval) clearInterval(pollingInterval);
}

async function refreshUserChat() {
    // Determine last timestamp to only fetch new? For simplicity, we just reload for now
    // A better approach would be to check counts or last ID. 
    // Given the constraints, re-fetching visible history is safe enough for small chats.
    // To avoid flicker, we could compare. But let's keep it simple first.

    try {
        const res = await fetch(`/api/messages/${activeContactId}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const messages = await res.json();

        // Simple diff: if count changed, reload. (Not perfect but works for simple case)
        const currentCount = chatHistory.querySelectorAll('.message').length;
        if (messages.length !== currentCount) {
            chatHistory.innerHTML = '';
            messages.forEach(msg => {
                const isMe = msg.senderId === currentUserId;
                appendMessage(msg.content, isMe ? 'user' : 'ai');
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
            currentUserId = data.userId; // Assuming backend sends this

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

    if (activeContactId === 'ai-agent') {
        await sendToAi(message);
    } else {
        await sendToUser(activeContactId, message);
    }
});

async function sendToAi(message) {
    sendBtn.disabled = true;

    // Typing indicator simulation
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

        const data = await res.json();
        typingDiv.remove();

        if (data.response) {
            appendMessage(data.response, 'ai');
        } else {
            appendMessage("Something went wrong.", 'ai');
        }
    } catch (error) {
        typingDiv.remove();
        appendMessage("Error connecting to server.", 'ai');
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
        // Message is already appended optimistically
    } catch (error) {
        console.error('Failed to send message:', error);
        appendMessage("Failed to send message.", 'ai');
    }
}

// Initial Check
checkAuth();
