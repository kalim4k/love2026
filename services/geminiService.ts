
import { GoogleGenAI } from "@google/genai";

// Sécurité pour éviter le crash au chargement si process.env n'est pas défini
const getAI = () => {
  const apiKey = typeof process !== 'undefined' && process.env && process.env.API_KEY 
    ? process.env.API_KEY 
    : "";
  return new GoogleGenAI({ apiKey });
};

export const generateHolidayWish = async (): Promise<string> => {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: "Write a very short, poetic, and magical Christmas wish (max 15 words) for a visitor to a digital winter wonderland.",
      config: {
        systemInstruction: "You are a mystical holiday spirit. Your tone is elegant, warm, and slightly formal.",
        temperature: 0.9,
      },
    });
    return response.text?.trim() || "May your holidays be filled with wonder and light.";
  } catch (error) {
    console.error("Gemini Wish Error:", error);
    return "Magic is all around you this winter season.";
  }
};
