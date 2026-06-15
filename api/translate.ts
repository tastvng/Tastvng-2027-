import { GoogleGenAI } from "@google/genai";
import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Method not allowed" });
  }
  
  try {
    const { text, source, target } = req.body;
    if (!text || !source || !target) {
      return res.status(400).json({ error: "Falten paràmetres 'text', 'source' o 'target'" });
    }

    if (!text.trim()) {
      return res.status(200).json({ translatedText: "" });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("GEMINI_API_KEY no està definit, pre-retornem text original.");
      return res.status(200).json({ translatedText: text }); 
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });

    const prompt = `Translate the following text from ${source} to ${target}.
Only return the raw translated text, without formatting, without quotes, without introductory text. 
Maintain the same capitalization and tone. If it contains placeholders like {{}} or HTML tags, leave them intact.

Text:
${text}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        temperature: 0.1,
      }
    });

    const translatedText = response.text || text;
    res.status(200).json({ translatedText: translatedText.trim() });

  } catch (error: any) {
    console.error("Gemini Translation Error (Vercel):", error);
    res.status(500).json({ error: "Error en la traducció", details: error.message });
  }
}
