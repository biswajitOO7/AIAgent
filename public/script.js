const chatHistory = document.getElementById('chat-history');
const chatForm = document.getElementById('chat-form');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');

// Load history on start
async function loadHistory() {
    try {
        const res = await fetch('/api/history');
        const history = await res.json();

        // Clear welcome message if there is history
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
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message })
        });

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

// Initial load
loadHistory();
