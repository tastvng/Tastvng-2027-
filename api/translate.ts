import { GoogleGenAI } from "@google/genai";
import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS configuration
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, PATCH, DELETE");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = req.body || {};
  const { text, target_language, q, source, target, source_language } = body;
  const textToTranslate = text || q || "";
  const targetLang = target_language || target || "es";
  const sourceLang = source || source_language || "ca";

  if (!textToTranslate || !textToTranslate.trim()) {
    return res.status(200).json({ translatedText: "" });
  }

  // 1. Try Google Gemini API if API key is present
  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  if (apiKey) {
    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build'
          }
        }
      });

      const targetName = targetLang === 'ca' ? 'Catalan' : 'Spanish';
      const sourceName = sourceLang === 'ca' ? 'Catalan' : (sourceLang === 'auto' ? 'the source language' : 'Spanish');

      let prompt = "";
      if (sourceLang === 'auto') {
        prompt = `You are a professional Catalan-Spanish bilingual translator.
Analyze the following text and determine its language (Catalan or Spanish).
- If the text is already in ${targetName}, return it exactly as is.
- Otherwise, translate it from its source language into ${targetName}.
Ensure you preserve any formatting, capitalizations, emoji, or style.
CRITICAL MANDATE: Never translate the word "Tast" or "El Tast". Keep the proper name "Tast" or "El Tast" exactly as is in the output text, without converting it to any other word.
Return ONLY the clean text, without preamble, thoughts, warnings, explanations, quotes, or markdown tags unless they were in the original.
Text: "${textToTranslate}"`;
      } else {
        prompt = `You are a professional Catalan-Spanish bilingual translator.
Translate the following text from ${sourceName} into ${targetName}.
Ensure you preserve any formatting, capitalizations, emoji, or style.
CRITICAL MANDATE: Never translate the word "Tast" or "El Tast". Keep the proper name "Tast" or "El Tast" exactly as is in the output text, without converting it to any other word.
Return ONLY the clean translated text, without preamble, thoughts, warnings, explanations, quotes, or markdown tags unless they were in the original.
Text: "${textToTranslate}"`;
      }

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          temperature: 0.1,
        }
      });

      let translatedText = response.text || textToTranslate;
      translatedText = translatedText.trim();
      if (translatedText.startsWith('"') && translatedText.endsWith('"') && !textToTranslate.startsWith('"')) {
        translatedText = translatedText.substring(1, translatedText.length - 1);
      }

      return res.status(200).json({ translatedText: translatedText.trim() });
    } catch (geminiError) {
      console.warn("[Translate API] Gemini translation failed, attempting LibreTranslate fallback:", geminiError);
    }
  }

  // 2. Fallback to LibreTranslate
  try {
    const libreResponse = await fetch("https://libretranslate.de/translate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        q: textToTranslate,
        source: sourceLang === 'auto' ? 'auto' : sourceLang,
        target: targetLang,
        format: "text"
      }),
      signal: AbortSignal.timeout(4000)
    });

    if (libreResponse.ok) {
      const data = await libreResponse.json();
      if (data.translatedText) {
        return res.status(200).json({ translatedText: data.translatedText });
      }
    }
  } catch (libreError) {
    console.warn("[Translate API] LibreTranslate fallback failed:", libreError);
  }

  // 3. Final Fallback: Return original text gracefully
  return res.status(200).json({ translatedText: textToTranslate });
}

