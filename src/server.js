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

// ...

// Start Server
async function startServer() {
    await connectDB();
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server is running on http://0.0.0.0:${PORT}`);
    });
}

startServer();
