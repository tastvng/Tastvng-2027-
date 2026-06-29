import express from "express";
import path from "path";
import nodemailer from "nodemailer";
import { Resend } from "resend";
import fs from "fs";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware to parse payload sizes
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // CORS and OPTIONS request preflight handling for routing compatibility
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, PATCH, DELETE");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

  // API Route to send a real SMTP email (Now via Resend)
  app.post("/api/send-email", async (req, res) => {
    try {
      const body = req.body || {};
      const apiKey = process.env.RESEND_API_KEY;

      if (!apiKey) {
        console.error("[Backend Error] RESEND_API_KEY environment variable is not defined.");
        return res.status(500).json({ error: "La clau de l'API de Resend (RESEND_API_KEY) no està configurada al servidor." });
      }

      const resend = new Resend(apiKey);

      // Extract values based on payload format
      let to = "";
      let subject = "Confirmació d'inscripció - El Tast 2026";
      let html = "";
      let attachments: any[] = [];

      if (body.emailData) {
        to = body.emailData.to;
        subject = body.emailData.subject || subject;
        html = body.emailData.html;
        attachments = body.emailData.attachments || [];
      } else {
        to = body.email || body.to;
        subject = body.subject || subject;
        html = body.html || "";
        if (body.qrCode) {
          const nombre = body.nombre || "Participant";
          html = `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2>Hola ${nombre},</h2>
              <p>La teva inscripció s'ha realitzat correctament.</p>
              <p>Aquí tens el teu codi QR de confirmació:</p>
              <div style="margin: 20px 0;">
                <img src="${body.qrCode}" alt="Codi QR" style="width: 200px; height: 200px;" />
              </div>
              <p>Presenta aquest codi per recollir el teu material.</p>
            </div>
          `;
        }
      }

      if (!to || !html) {
        console.error("[Backend Error] Missing required fields (to, html).");
        return res.status(400).json({ error: "Falten camps obligatoris (destinatari o contingut HTML)" });
      }

      // Process attachments for Resend
      let resendAttachments: any[] = [];
      if (attachments && Array.isArray(attachments)) {
        resendAttachments = attachments.map((att: any) => {
          if (att.content && typeof att.content === 'string' && att.content.startsWith('data:')) {
            const matches = att.content.match(/^data:(.+);base64,(.+)$/);
            if (matches) {
              const base64Data = matches[2];
              return {
                filename: att.filename || "image.png",
                content: Buffer.from(base64Data, 'base64'),
                content_id: att.cid || undefined
              };
            }
          }
          return att;
        });
      }

      // Send email using Resend
      const response = await resend.emails.send({
        from: 'noreply@tastvng.cat',
        to: [to],
        subject,
        html,
        attachments: resendAttachments.length > 0 ? resendAttachments : undefined,
      });

      if (response.error) {
        console.error("[Backend Error] Resend API error:", response.error);
        return res.status(400).json({ error: response.error.message });
      }

      console.log("Email sent successfully through Resend:", response.data?.id);

      return res.json({
        success: true,
        id: response.data?.id,
        messageId: response.data?.id
      });
    } catch (error: any) {
      console.error("Error sending email via Resend:", error);
      return res.status(500).json({
        error: error.message || "Error al enviar el correo a través de Resend."
      });
    }
  });

  // Base API healthcheck endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: new Date() });
  });

  // Lazy load GoogleGenAI client for translation
  let aiClient: any = null;

  app.post("/api/translate", async (req, res) => {
    try {
      const { text, source, target } = req.body;
      if (!text || !source || !target) {
        return res.status(400).json({ error: "Falten paràmetres 'text', 'source' o 'target'" });
      }

      if (!text.trim()) {
        return res.json({ translatedText: "" });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        console.warn("GEMINI_API_KEY no està definit, pre-retornem text original.");
        return res.json({ translatedText: text }); 
      }

      if (!aiClient) {
        const { GoogleGenAI } = await import("@google/genai");
        aiClient = new GoogleGenAI({
          apiKey,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            }
          }
        });
      }

      const targetName = target === 'ca' ? 'Catalan' : 'Spanish';

      let prompt = '';
      if (source === 'auto') {
        prompt = `You are a professional Catalan-Spanish bilingual translator.
Analyze the following text and determine its language (Catalan or Spanish).
- If the text is already in ${targetName}, return it exactly as is.
- If the text is in the other language, translate it into ${targetName}.
Ensure you preserve any formatting, capitalizations, emoji, or style.
CRITICAL MANDATE: Never translate the word "Tast" or "El Tast". Keep the proper name "Tast" or "El Tast" exactly as is in the output text, without converting it to any other word.
Return ONLY the clean text, without preamble, thoughts, warnings, explanations, quotes, or markdown tags unless they were in the original.
Text: "${text}"`;
      } else {
        const sourceName = source === 'ca' ? 'Catalan' : 'Spanish';
        prompt = `You are a professional Catalan-Spanish bilingual translator.
Translate the following text from ${sourceName} into ${targetName}.
Ensure you preserve any formatting, capitalizations, emoji, or style.
CRITICAL MANDATE: Never translate the word "Tast" or "El Tast". Keep the proper name "Tast" or "El Tast" exactly as is in the output text, without converting it to any other word.
Return ONLY the clean translated text, without preamble, thoughts, warnings, explanations, quotes, or markdown tags unless they were in the original.
Text: "${text}"`;
      }

      const response = await aiClient.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          temperature: 0.1,
        }
      });

      let translatedText = response.text || "";
      translatedText = translatedText.trim();
      if (translatedText.startsWith('"') && translatedText.endsWith('"') && !text.startsWith('"')) {
        translatedText = translatedText.substring(1, translatedText.length - 1);
      }

      return res.json({ translatedText: translatedText.trim() });
    } catch (error: any) {
      const errMsg = error?.message || String(error);
      const isQuota = errMsg.includes("429") || errMsg.includes("503") || errMsg.includes("quota") || errMsg.includes("RESOURCE_EXHAUSTED") || errMsg.includes("UNAVAILABLE");
      
      if (isQuota) {
        console.warn("Translation API quota exceeded (free tier limit reached). Bypassing translations gracefully.");
        return res.status(429).json({ 
          error: "quota_exceeded", 
          translatedText: req.body.text || "" 
        });
      }
      
      console.error("Error in translation API:", error);
      return res.status(500).json({ 
        error: "translation_failed", 
        translatedText: req.body.text || "" 
      });
    }
  });

  // Vite development server / static production delivery
  const distPath = path.join(process.cwd(), 'dist');
  const isProduction = process.env.NODE_ENV !== "development";

  if (!isProduction) {
    console.log("Starting server in development mode with Vite middleware...");
    const { createServer } = await eval('import("vite")');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log(`Starting server in production mode. Serving static files from: ${distPath}`);
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on port ${PORT} with environment ${process.env.NODE_ENV || 'production'} (detected ${isProduction ? 'production' : 'development'} mode)`);
  });
}

startServer();
