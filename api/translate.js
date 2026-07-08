import { GoogleGenAI } from "@google/genai";

export default async function handler(req, res) {
  // CORS and OPTIONS request preflight handling
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, PATCH, DELETE");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { text, target_language, q, source, target } = req.body || {};
  const textToTranslate = text || q || "";
  const targetLang = target_language || target || "es";
  const sourceLang = source || "ca";

  if (!textToTranslate || !textToTranslate.trim()) {
    return res.status(200).json({ translatedText: "" });
  }

  // 1. Try LibreTranslate first
  try {
    const response = await fetch('https://libretranslate.de/translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: textToTranslate,
        source: sourceLang === 'auto' ? 'auto' : sourceLang,
        target: targetLang,
        format: 'text'
      }),
    });

    if (response.ok) {
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        try {
          const data = await response.json();
          if (data && data.translatedText) {
            return res.status(200).json({ translatedText: data.translatedText });
          }
        } catch (jsonErr) {
          console.warn("Failed to parse LibreTranslate JSON response on Vercel proxy, falling back to Gemini:", jsonErr);
        }
      } else {
        const textResponse = await response.text();
        console.warn(`LibreTranslate returned non-JSON content on Vercel proxy (Type: ${contentType}), falling back to Gemini. Body snippet:`, textResponse.substring(0, 150));
      }
    } else {
      const errorText = await response.text();
      console.warn("LibreTranslate API failed on Vercel proxy, falling back to Gemini:", errorText.substring(0, 150));
    }
  } catch (err) {
    console.warn("LibreTranslate fetch error on Vercel proxy, falling back to Gemini:", err.message || err);
  }

  // 2. Fallback to Gemini if LibreTranslate fails
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("GEMINI_API_KEY is not defined. Returning original text as final fallback.");
    return res.status(200).json({ translatedText: textToTranslate });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const targetName = targetLang === 'ca' ? 'Catalan' : 'Spanish';
    const sourceName = sourceLang === 'ca' ? 'Catalan' : 'Spanish';

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

    const aiResponse = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    let translatedText = aiResponse.text || "";
    translatedText = translatedText.trim();
    if (translatedText.startsWith('"') && translatedText.endsWith('"') && !textToTranslate.startsWith('"')) {
      translatedText = translatedText.substring(1, translatedText.length - 1);
    }

    return res.status(200).json({ translatedText });
  } catch (error) {
    console.error("Gemini fallback translation error on Vercel proxy:", error);
    return res.status(200).json({ translatedText: textToTranslate });
  }
}
