const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcryptjs');

let client;
let db;
let usersCollection;
let chatsCollection;

async function connectDB() {
    if (client) return;

    try {
        client = new MongoClient(process.env.MONGODB_URI);
        await client.connect();
        db = client.db();
        usersCollection = db.collection('users');
        chatsCollection = db.collection('chat_history');
        console.log('Connected to MongoDB');
    } catch (error) {
        console.error('MongoDB connection error:', error);
        process.exit(1);
    }
}

async function registerUser(username, password) {
    if (!usersCollection) await connectDB();
    const existingUser = await usersCollection.findOne({ username });
    if (existingUser) {
        throw new Error('Username already exists');
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await usersCollection.insertOne({
        username,
        password: hashedPassword,
        createdAt: new Date()
    });
    return result.insertedId;
}

async function findUser(username) {
    if (!usersCollection) await connectDB();
    return await usersCollection.findOne({ username });
}

async function saveInteraction(userId, userInput, agentResponse) {
    if (!chatsCollection) await connectDB();
    await chatsCollection.insertOne({
        userId: new ObjectId(userId), // specific to user
        userInput,
        agentResponse,
        timestamp: new Date()
    });
}

async function getRecentHistory(userId, limit = 10) {
    if (!chatsCollection) await connectDB();
    const history = await chatsCollection.find({ userId: new ObjectId(userId) })
        .sort({ timestamp: -1 })
        .limit(limit)
        .toArray();

    return history.reverse().map(doc => ({
        input: doc.userInput,
        output: doc.agentResponse
    }));
}

module.exports = { connectDB, registerUser, findUser, saveInteraction, getRecentHistory };
