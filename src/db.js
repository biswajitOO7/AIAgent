const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcryptjs');

let client;
let db;
let usersCollection;
let chatsCollection;
let messagesCollection;
let groupsCollection;
let groupMessagesCollection;
let notesCollection;

let connectionError = null;

async function connectDB() {
    if (client) return;

    try {
        console.log("Connecting to MongoDB...");
        client = new MongoClient(process.env.MONGODB_URI);
        await client.connect();
        db = client.db();
        usersCollection = db.collection('users');
        chatsCollection = db.collection('chat_history');
        messagesCollection = db.collection('direct_messages');
        groupsCollection = db.collection('groups');
        groupMessagesCollection = db.collection('group_messages');
        notesCollection = db.collection('notes');
        console.log('Connected to MongoDB successfully');
        connectionError = null;
    } catch (error) {
        console.error('MongoDB connection error:', error);
        connectionError = error.message;
        // Do not exit, allow health check to report
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

async function getAllUsers() {
    if (!usersCollection) await connectDB();
    return await usersCollection.find({}, { projection: { password: 0 } }).toArray();
}

async function saveInteraction(userId, userInput, agentResponse) {
    if (!chatsCollection) await connectDB();
    await chatsCollection.insertOne({
        userId: new ObjectId(userId),
        userInput,
        agentResponse,
        timestamp: new Date()
    });
}

async function getRecentHistory(userId, limit = 10) {
    if (!chatsCollection) await connectDB();
    // Double check connection
    if (!chatsCollection) {
        console.error("Attempted to fetch history but chatsCollection is null. DB Connection Error:", connectionError);
        throw new Error("Database Disconnected");
    }

    const history = await chatsCollection.find({ userId: new ObjectId(userId) })
        .sort({ timestamp: -1 })
        .limit(limit)
        .toArray();

    return history.reverse().map(doc => ({
        input: doc.userInput,
        output: doc.agentResponse
    }));
}

async function saveDirectMessage(senderId, recipientId, content) {
    if (!messagesCollection) await connectDB();
    await messagesCollection.insertOne({
        senderId: new ObjectId(senderId),
        recipientId: new ObjectId(recipientId),
        content,
        timestamp: new Date()
    });
}

async function getDirectMessages(userId1, userId2, limit = 50) {
    if (!messagesCollection) await connectDB();
    const msgs = await messagesCollection.find({
        $or: [
            { senderId: new ObjectId(userId1), recipientId: new ObjectId(userId2) },
            { senderId: new ObjectId(userId2), recipientId: new ObjectId(userId1) }
        ]
    })
        .sort({ timestamp: -1 })
        .limit(limit)
        .toArray();

    return msgs.reverse().map(msg => ({
        content: msg.content,
        senderId: msg.senderId.toString(),
        timestamp: msg.timestamp
    }));
}

// Group Chat Functions

async function createGroup(name, creatorId, memberIds) {
    if (!groupsCollection) await connectDB();

    const members = [...new Set([creatorId, ...memberIds])].map(id => new ObjectId(id));

    const result = await groupsCollection.insertOne({
        name,
        creatorId: new ObjectId(creatorId),
        members,
        createdAt: new Date()
    });
    return result.insertedId;
}

async function getUserGroups(userId) {
    if (!groupsCollection) await connectDB();
    return await groupsCollection.find({ members: new ObjectId(userId) }).toArray();
}

async function saveGroupMessage(groupId, senderId, content) {
    if (!groupMessagesCollection) await connectDB();

    // Get sender name for display optimization (optional, but good for simple apps)
    // For now, we'll just store IDs and fetch sender info or rely on frontend to map IDs to names if it has user list
    // OR we can store username in message. Let's store username to save lookups.
    const user = await usersCollection.findOne({ _id: new ObjectId(senderId) });

    await groupMessagesCollection.insertOne({
        groupId: new ObjectId(groupId),
        senderId: new ObjectId(senderId),
        senderName: user ? user.username : 'Unknown',
        content,
        timestamp: new Date()
    });
}

async function getGroupMessages(groupId, limit = 50) {
    if (!groupMessagesCollection) await connectDB();
    const msgs = await groupMessagesCollection.find({ groupId: new ObjectId(groupId) })
        .sort({ timestamp: -1 })
        .limit(limit)
        .toArray();

    return msgs.reverse().map(msg => ({
        content: msg.content,
        senderId: msg.senderId.toString(),
        senderName: msg.senderName,
        timestamp: msg.timestamp
    }));
}

// Safe collection access helper
function getCollection(name) {
    if (!db) {
        throw new Error('Database not connected');
    }
    return db.collection(name);
}

const getConnectionError = () => {
    return connectionError;
};

async function getRecentHistory(userId, limit = 10) {
    if (!chatsCollection) await connectDB();
    if (!chatsCollection) throw new Error("Database not initialized");

    const history = await chatsCollection.find({ userId: new ObjectId(userId) })
        .sort({ timestamp: -1 })
        .limit(limit)
        .toArray();

    return history.reverse().map(doc => ({
        input: doc.userInput,
        output: doc.agentResponse
    }));
}

// ... (Updating other functions similarly to be safe would be good, but let's focus on history first to be surgical)

// Debug helper
async function getDebugStats() {
    if (!usersCollection) await connectDB();
    const userCount = await usersCollection.countDocuments();
    const chatCount = await chatsCollection.countDocuments();
    const sampleChat = await chatsCollection.findOne({});

    return {
        userCount,
        chatCount,
        sampleChat
    };
}

// Repair helper
async function claimOrphanedChats(userId) {
    if (!chatsCollection) await connectDB();
    const result = await chatsCollection.updateMany(
        { userId: { $exists: false } }, // Find chats without userId
        { $set: { userId: new ObjectId(userId) } } // Assign to this user
    );
    return result.modifiedCount;
}

// Notes Functions

async function saveNote(userId, content) {
    if (!notesCollection) await connectDB();
    if (!notesCollection) throw new Error("Database not initialized");

    const result = await notesCollection.insertOne({
        userId: new ObjectId(userId),
        content,
        timestamp: new Date()
    });
    return result.insertedId;
}

async function getNotes(userId) {
    if (!notesCollection) await connectDB();
    if (!notesCollection) return [];

    const notes = await notesCollection.find({ userId: new ObjectId(userId) })
        .sort({ timestamp: -1 })
        .toArray();

    return notes.map(note => ({
        id: note._id.toString(),
        content: note.content,
        timestamp: note.timestamp
    }));
}

async function deleteNote(userId, noteId) {
    if (!notesCollection) await connectDB();
    if (!notesCollection) throw new Error("Database not initialized");

    await notesCollection.deleteOne({
        _id: new ObjectId(noteId),
        userId: new ObjectId(userId) // Ensure ownership
    });
}

module.exports = {
    connectDB,
    getConnectionError,
    getDebugStats,
    claimOrphanedChats,
    registerUser,
    findUser,
    getAllUsers,
    saveInteraction,
    getRecentHistory,
    saveDirectMessage,
    getDirectMessages,
    createGroup,
    getUserGroups,
    saveGroupMessage,
    getGroupMessages,
    saveNote,   // Export
    getNotes,   // Export
    deleteNote  // Export
};
