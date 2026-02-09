const express = require('express');
const cors = require('cors');
const path = require('path');
const { connectDB, saveInteraction, getRecentHistory } = require('./db');
const { getAgentResponse } = require('./agent');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 7860;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Routes
app.get('/api/history', async (req, res) => {
    try {
        const history = await getRecentHistory();
        res.json(history);
    } catch (error) {
        console.error('History Error:', error);
        res.status(500).json([]);
    }
});

app.post('/api/chat', async (req, res) => {
    try {
        const { message } = req.body;
        if (!message) return res.status(400).json({ error: 'Message is required' });

        const response = await getAgentResponse(message);
        res.json({ response });
    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
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
