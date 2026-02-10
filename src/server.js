const express = require('express');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const {
    connectDB,
    saveInteraction,
    getRecentHistory,
    registerUser,
    findUser,
    getAllUsers,
    saveDirectMessage,
    getDirectMessages,
    createGroup,
    getUserGroups,
    saveGroupMessage,
    getGroupMessages,
    getConnectionError,
    getDebugStats // Import
} = require('./db');
const { getAgentResponse } = require('./agent');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 7860;
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Auth Middleware
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
}

// Health Check
app.get('/api/health', async (req, res) => {
    try {
        await connectDB();
        const err = getConnectionError();
        if (err) {
            return res.status(503).json({ status: 'error', dbError: err });
        }
        res.json({ status: 'ok', message: 'Database connected' });
    } catch (e) {
        res.status(500).json({ status: 'error', error: e.message });
    }
});

// Deep Debug Route
app.get('/api/debug/db', async (req, res) => {
    try {
        const stats = await getDebugStats();
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Routes
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

        const userId = await registerUser(username, password);
        res.status(201).json({ message: 'User registered', userId });
    } catch (error) {
        console.error('Registration Error:', error);
        res.status(400).json({ error: error.message });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await findUser(username);

        if (!user) return res.status(400).json({ error: 'User not found' });

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) return res.status(400).json({ error: 'Invalid password' });

        const token = jwt.sign({ userId: user._id, username: user.username }, JWT_SECRET, { expiresIn: '1h' });
        res.json({ token, username: user.username, userId: user._id.toString() });
    } catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/api/users', authenticateToken, async (req, res) => {
    try {
        const users = await getAllUsers();
        // Filter out current user from the list
        const otherUsers = users.filter(u => u._id.toString() !== req.user.userId);
        res.json(otherUsers);
    } catch (error) {
        console.error('Get Users Error:', error);
        res.status(500).json([]);
    }
});

app.get('/api/history', authenticateToken, async (req, res) => {
    try {
        const history = await getRecentHistory(req.user.userId);
        res.json(history);
    } catch (error) {
        console.error('History Error:', error);
        res.status(500).json([]);
    }
});

app.post('/api/chat', authenticateToken, async (req, res) => {
    try {
        const { message } = req.body;
        if (!message) return res.status(400).json({ error: 'Message is required' });

        const response = await getAgentResponse(req.user.userId, message);
        res.json({ response });
    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Direct Messaging Routes
app.get('/api/messages/:otherUserId', authenticateToken, async (req, res) => {
    try {
        const { otherUserId } = req.params;
        const messages = await getDirectMessages(req.user.userId, otherUserId);
        res.json(messages);
    } catch (error) {
        console.error('Get Messages Error:', error);
        res.status(500).json([]);
    }
});

app.post('/api/messages/send', authenticateToken, async (req, res) => {
    try {
        const { recipientId, content } = req.body;
        if (!recipientId || !content) return res.status(400).json({ error: 'Recipient and content required' });

        await saveDirectMessage(req.user.userId, recipientId, content);
        res.json({ success: true });
    } catch (error) {
        console.error('Send Message Error:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

// Group Chat Routes
app.post('/api/groups', authenticateToken, async (req, res) => {
    try {
        const { name, members } = req.body;
        if (!name || !members || !Array.isArray(members)) {
            return res.status(400).json({ error: 'Valid name and members array required' });
        }

        // Members should include creator (added in db function)
        const groupId = await createGroup(name, req.user.userId, members);
        res.status(201).json({ groupId, name });
    } catch (error) {
        console.error('Create Group Error:', error);
        res.status(500).json({ error: 'Failed to create group' });
    }
});

app.get('/api/groups', authenticateToken, async (req, res) => {
    try {
        const groups = await getUserGroups(req.user.userId);
        res.json(groups);
    } catch (error) {
        console.error('Get Groups Error:', error);
        res.status(500).json([]);
    }
});

app.get('/api/groups/:groupId/messages', authenticateToken, async (req, res) => {
    try {
        const { groupId } = req.params;
        const messages = await getGroupMessages(groupId);
        res.json(messages);
    } catch (error) {
        console.error('Get Group Messages Error:', error);
        res.status(500).json([]);
    }
});

app.post('/api/groups/:groupId/messages', authenticateToken, async (req, res) => {
    try {
        const { groupId } = req.params;
        const { content } = req.body;
        if (!content) return res.status(400).json({ error: 'Content required' });

        await saveGroupMessage(groupId, req.user.userId, content);
        res.json({ success: true });
    } catch (error) {
        console.error('Send Group Message Error:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
});


// Start Server
async function startServer() {
    await connectDB();
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server is running on http://0.0.0.0:${PORT}`);
    });
}

startServer();
