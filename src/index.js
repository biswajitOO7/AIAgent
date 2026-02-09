const readline = require('readline');
const { connectDB } = require('./db');
const { getAgentResponse } = require('./agent');
require('dotenv').config();

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

async function main() {
    console.log("Initializing AI Agent...");

    if (!process.env.HUGGINGFACEHUB_API_KEY) {
        console.error("Error: HUGGINGFACEHUB_API_KEY is missing in .env file.");
        process.exit(1);
    }

    if (!process.env.MONGODB_URI) {
        console.error("Error: MONGODB_URI is missing in .env file.");
        process.exit(1);
    }

    await connectDB();
    console.log("AI Agent Ready! Type 'exit' to quit.\n");

    const promptUser = () => {
        rl.question('You: ', async (input) => {
            if (input.toLowerCase() === 'exit') {
                rl.close();
                process.exit(0);
            }

            const response = await getAgentResponse(input);
            console.log(`Agent: ${response}\n`);

            promptUser();
        });
    };

    promptUser();
}

main();
