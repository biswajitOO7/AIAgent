const { HfInference } = require('@huggingface/inference');
const { saveInteraction, getRecentHistory } = require('./db');
require('dotenv').config();

const hf = new HfInference(process.env.HUGGINGFACEHUB_API_KEY);

const SYSTEM_PROMPT = `You are a helpful AI assistant. You answer questions and help with tasks.
You have access to the following history of our conversation. Use it to provide context-aware responses.
`;

async function getAgentResponse(userId, userInput) {
    try {
        const history = await getRecentHistory(userId);

        let messages = [
            { role: "system", content: SYSTEM_PROMPT }
        ];

        // Add history to messages for context
        if (history.length > 0) {
            history.forEach(h => {
                messages.push({ role: "user", content: h.input });
                messages.push({ role: "assistant", content: h.output });
            });
        }

        // Add current user input
        messages.push({ role: "user", content: userInput });

        console.log("Sending request to Hugging Face (Kimi-2.5)...");

        const response = await hf.chatCompletion({
            model: 'moonshotai/Kimi-K2.5',
            messages: messages,
            max_tokens: 512,
            temperature: 0.7
        });

        const answer = response.choices[0].message.content;
        await saveInteraction(userId, userInput, answer);

        return answer;

    } catch (error) {
        console.error("Error generating response:", error.message);
        return "I encountered an error. Please check your API key or model availability.";
    }
}

module.exports = { getAgentResponse };
