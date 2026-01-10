import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = "AIzaSyCFMnR_25NvqvKzo2NBRSgQ4vnewwhB77Q";
const genAI = new GoogleGenerativeAI(apiKey);

async function listModels() {
    try {
        const models = ["gemini-3-flash", "gemini-2.0-flash-exp", "gemini-1.5-flash", "gemini-3-flash-preview"];
        console.log("Checking model availability...");
        for (const m of models) {
            try {
                const model = genAI.getGenerativeModel({ model: m });
                // We just need to check if the model object can be retrieved and a basic request works
                const result = await model.generateContent("Say hello");
                const text = result.response.text();
                if (text) {
                    console.log(`✅ Model ${m} is AVAILABLE`);
                }
            } catch (e) {
                console.log(`❌ Model ${m} is NOT AVAILABLE: ${e.message}`);
            }
        }
    } catch (error) {
        console.error("Error listing models:", error);
    }
}

listModels();
