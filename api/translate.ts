import { GoogleGenAI } from "@google/genai";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const checkRateLimit = (ip: string, maxRequests: number, windowMs: number): boolean => {
  const now = Date.now();
  const current = rateLimitMap.get(ip);
  if (!current || now > current.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs });
    return true;
  }
  if (current.count >= maxRequests) {
    return false;
  }
  current.count += 1;
  return true;
};

const ALLOWED_ORIGIN_PATTERNS = [
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,
  /^https:\/\/[\w-]+\.vercel\.app$/,
  /^https:\/\/[\w-]+\.run\.app$/
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin as string;
  if (origin) {
    const isAllowed = 
      origin === process.env.APP_URL ||
      ALLOWED_ORIGIN_PATTERNS.some(pattern => pattern.test(origin)) ||
      origin === `http://${req.headers.host}` ||
      origin === `https://${req.headers.host}`;

    if (isAllowed) {
      res.setHeader("Access-Control-Allow-Origin", origin);
    }
  }

  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket?.remoteAddress || 'unknown';
  if (!checkRateLimit(clientIp, 30, 60 * 1000)) {
    return res.status(429).json({ error: "Límit de peticions assolit per minut." });
  }

  const body = req.body || {};
  const { text, target_language, q, source, target, source_language } = body;
  const textToTranslate = text || q || "";
  const targetLang = target_language || target || "es";
  const sourceLang = source || source_language || "ca";

  if (!textToTranslate || !textToTranslate.trim()) {
    return res.status(200).json({ translatedText: "" });
  }

  if (textToTranslate.length > 5000) {
    return res.status(400).json({ error: "Text exceeds maximum 5000 character limit" });
  }

  // 1. Try Google Gemini API strictly via server secret
  const apiKey = process.env.GEMINI_API_KEY;
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
      console.warn("[Translate API] Gemini translation failed, attempting fallback:", geminiError);
    }
  }

  // 2. Safe Fallback
  return res.status(200).json({ translatedText: textToTranslate });
}
