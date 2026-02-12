import { GoogleGenAI } from "@google/genai";
import * as dotenv from 'dotenv';
dotenv.config();

const apiKey = process.env.API_KEY;
const ai = new GoogleGenAI({ apiKey: apiKey || "" });

async function checkModels() {
    try {
        // @ts-ignore
        const response = await ai.models.list();

        console.log("Gemini Models:");
        // @ts-ignore
        if (response.models) {
            // @ts-ignore
            response.models.forEach(m => {
                if (m.name.includes("gemini")) {
                    console.log(`${m.name} - Actions: ${m.supportedActions}`);
                }
            });
        }
    } catch (error) {
        console.error("Error listing models:", error);
    }
}

checkModels();
