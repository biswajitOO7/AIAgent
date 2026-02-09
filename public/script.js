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

let isLoginMode = true;
let authToken = localStorage.getItem('authToken');

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
        logoutBtn.classList.remove('hidden');
        loadHistory();
    } else {
        authModal.classList.remove('hidden');
        chatInterface.classList.add('hidden');
        logoutBtn.classList.add('hidden');
        chatHistory.innerHTML = `
            <div class="welcome-message">
                <h2>Hello! 👋</h2>
                <p>I am your AI assistant. How can I help you today?</p>
            </div>
        `;
    }
}

function checkTokenValidity(response) {
    if (response.status === 401 || response.status === 403) {
        logout();
        return false;
    }
    return true;
}

function logout() {
    localStorage.removeItem('authToken');
    authToken = null;
    checkAuth();
}

// --- Event Listeners ---

authSwitchBtn.addEventListener('click', (e) => {
    e.preventDefault();
    toggleAuthMode();
});

logoutBtn.addEventListener('click', logout);

authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    authError.textContent = '';

    // Simple validation
    if (!username || !password) {
        authError.textContent = 'Please fill in all fields';
        return;
    }

    const endpoint = isLoginMode ? '/api/auth/login' : '/api/auth/register';

    try {
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.error || 'Authentication failed');
        }

        if (isLoginMode) {
            authToken = data.token;
            localStorage.setItem('authToken', authToken);
            checkAuth();
        } else {
            // After register, switch to login
            toggleAuthMode();
            authError.style.color = '#10b981'; // Success color
            authError.textContent = 'Registration successful! Please login.';
            setTimeout(() => {
                authError.style.color = '';
                authError.textContent = '';
            }, 3000);
        }
    } catch (error) {
        authError.textContent = error.message;
    }
});

// --- Chat Functions ---

async function loadHistory() {
    if (!authToken) return;

    try {
        const res = await fetch('/api/history', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (!checkTokenValidity(res)) return;

        const history = await res.json();

        if (history.length > 0) {
            chatHistory.innerHTML = '';
            history.forEach(msg => {
                appendMessage(msg.input, 'user');
                appendMessage(msg.output, 'ai');
            });
            scrollToBottom();
        }
    } catch (error) {
        console.error("Failed to load history:", error);
    }
}

function appendMessage(text, sender) {
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('message', sender);
    msgDiv.textContent = text;
    chatHistory.appendChild(msgDiv);
    scrollToBottom();
}

function showTypingIndicator() {
    const typingDiv = document.createElement('div');
    typingDiv.classList.add('typing-indicator');
    typingDiv.id = 'typing-indicator';
    typingDiv.innerHTML = `
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
    `;
    chatHistory.appendChild(typingDiv);
    scrollToBottom();
}

function removeTypingIndicator() {
    const typingDiv = document.getElementById('typing-indicator');
    if (typingDiv) typingDiv.remove();
}

function scrollToBottom() {
    chatHistory.scrollTop = chatHistory.scrollHeight;
}

chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!authToken) return;

    const message = userInput.value.trim();
    if (!message) return;

    // Display user message
    appendMessage(message, 'user');
    userInput.value = '';
    sendBtn.disabled = true;

    // Show typing indicator
    showTypingIndicator();

    try {
        const res = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ message })
        });

        if (!checkTokenValidity(res)) {
            removeTypingIndicator();
            return;
        }

        const data = await res.json();
        removeTypingIndicator();

        if (data.response) {
            appendMessage(data.response, 'ai');
        } else {
            appendMessage("Something went wrong.", 'ai');
        }
    } catch (error) {
        removeTypingIndicator();
        appendMessage("Error connecting to server.", 'ai');
        console.error(error);
    } finally {
        sendBtn.disabled = false;
        userInput.focus();
    }
});

// Initial Status Check
checkAuth();
