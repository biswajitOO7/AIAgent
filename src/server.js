const express = require('express');
const cors = require('cors');
const path = require('path');
const { connectDB, saveInteraction, getRecentHistory } = require('./db');
const { getAgentResponse } = require('./agent');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Routes
app.get('/api/history', async (req, res) => {
    try {
        const history = await getRecentHistory(20); // Fetch last 20 messages
        res.json(history);
    } catch (error) {
        console.error("Error fetching history:", error);
        res.status(500).json({ error: "Failed to fetch history" });
    }
});

app.post('/api/chat', async (req, res) => {
    const { message } = req.body;
    if (!message) {
        return res.status(400).json({ error: "Message is required" });
    }

    try {
        const response = await getAgentResponse(message);
        res.json({ response });
    } catch (error) {
        console.error("Error processing chat:", error);
        res.status(500).json({ error: "Failed to process chat" });
    }
});

// Start Server
async function startServer() {
    await connectDB();
    app.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
    });
}

startServer();
