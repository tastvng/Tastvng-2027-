// /api/translate.js
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

  try {
    const { text, target_language, q, source, target } = req.body;
    
    // Support both formats:
    // 1. { text, target_language }
    // 2. { q, source, target }
    const textToTranslate = text || q || "";
    const targetLang = target_language || target || "es";
    const sourceLang = source || "ca";

    if (!textToTranslate.trim()) {
      return res.status(200).json({ translatedText: "" });
    }

    const response = await fetch('https://libretranslate.de/translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: textToTranslate,
        source: sourceLang,
        target: targetLang,
        format: 'text'
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return res.status(200).json({
        translatedText: data.translatedText || textToTranslate
      });
    } else {
      const errorText = await response.text();
      console.error("LibreTranslate API failed on serverless proxy:", errorText);
      // Return original text as fallback
      return res.status(200).json({ translatedText: textToTranslate });
    }
  } catch (error) {
    console.error("Error in serverless translate proxy function:", error);
    return res.status(200).json({ translatedText: req.body?.text || req.body?.q || "" });
  }
}
