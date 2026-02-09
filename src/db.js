const { MongoClient } = require('mongodb');

let client;
let db;
let collection;

async function connectDB() {
    if (client) return;

    try {
        client = new MongoClient(process.env.MONGODB_URI);
        await client.connect();
        db = client.db();
        collection = db.collection('chat_history');
        console.log('Connected to MongoDB');
    } catch (error) {
        console.error('MongoDB connection error:', error);
        process.exit(1);
    }
}

async function saveInteraction(userInput, agentResponse) {
    if (!collection) await connectDB();
    await collection.insertOne({
        userInput,
        agentResponse,
        timestamp: new Date()
    });
}

async function getRecentHistory(limit = 5) {
    if (!collection) await connectDB();
    const history = await collection.find()
        .sort({ timestamp: -1 })
        .limit(limit)
        .toArray();
    
    return history.reverse().map(doc => ({
        input: doc.userInput,
        output: doc.agentResponse
    }));
}

module.exports = { connectDB, saveInteraction, getRecentHistory };
