import express from "express";
import path from "path";
import nodemailer from "nodemailer";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import dotenv from "dotenv";

// Load local development environment variables first, then default .env
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware to parse payload sizes
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Security Headers
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    next();
  });

  // CORS handling with origin validation
  const ALLOWED_ORIGIN_PATTERNS = [
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,
    /^https:\/\/[\w-]+\.vercel\.app$/,
    /^https:\/\/[\w-]+\.run\.app$/
  ];

  app.use((req, res, next) => {
    const origin = req.headers.origin;
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
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, PATCH, DELETE");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

  // In-memory rate limiting map for sensitive endpoints
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

  // Status check for SMTP (NEVER returns passwords or secrets)
  app.get("/api/smtp-status", (_req, res) => {
    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = process.env.SMTP_PORT || '587';
    const user = process.env.SMTP_USER || '';
    const from = process.env.SMTP_FROM || process.env.SMTP_USER || '';
    const configured = !!(process.env.SMTP_PASSWORD && process.env.SMTP_USER);

    res.json({
      configured,
      host,
      port,
      user: user ? user.replace(/^(.{2})(.*)(@.*)$/, '$1***$3') : '',
      from: from ? from.replace(/^(.{2})(.*)(@.*)$/, '$1***$3') : '',
      provider: 'Server Environment Variables (Secure)'
    });
  });

  // Authoritative server-side validation & price calculation for inscriptions
  app.post("/api/validate-inscription", (req, res) => {
    try {
      const data = req.body || {};
      const { categoria, teDomasBalco, teMocadorsExtra, c1Nom, c1Cognoms, c1Email, c1Telefon, c2Nom, c2Cognoms, c2Email, c2Telefon, c1EsMenor, c2EsMenor, c1TutorDni, c2TutorDni } = data;

      // Basic presence validation
      if (!c1Nom?.trim() || !c1Cognoms?.trim() || !c1Email?.trim() || !c1Telefon?.trim() ||
          !c2Nom?.trim() || !c2Cognoms?.trim() || !c2Email?.trim() || !c2Telefon?.trim()) {
        return res.status(400).json({ error: "Falten dades obligatòries dels participants." });
      }

      // Email format validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(c1Email.trim()) || !emailRegex.test(c2Email.trim())) {
        return res.status(400).json({ error: "El format del correu electrònic no és vàlid." });
      }

      // Minor validation
      if (c1EsMenor && !c1TutorDni?.trim()) {
        return res.status(400).json({ error: "Cal el DNI del tutor/a legal per al primer participant menor d'edat." });
      }
      if (c2EsMenor && !c2TutorDni?.trim()) {
        return res.status(400).json({ error: "Cal el DNI del tutor/a legal per al segon participant menor d'edat." });
      }

      // Authoritative official price calculation
      // Standard prices: Adult = 40€, Juvenil = 30€ (or configured defaults)
      const basePrice = (categoria === 'JUVENIL') ? 30 : 40;
      const domasPrice = teDomasBalco ? 15 : 0;
      const mocadorQty = Math.max(0, parseInt(String(teMocadorsExtra || 0), 10) || 0);
      const mocadorsPrice = mocadorQty * 5;
      const calculatedTotal = basePrice + domasPrice + mocadorsPrice;

      return res.json({
        valid: true,
        basePrice,
        domasPrice,
        mocadorQty,
        mocadorsPrice,
        total: calculatedTotal
      });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "Error en la validació al servidor." });
    }
  });

  // API Route to send a real SMTP email (Strictly Server-Side Environment Variables)
  app.post("/api/send-email", async (req, res) => {
    try {
      const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress || 'unknown';
      if (!checkRateLimit(clientIp, 10, 60 * 1000)) {
        return res.status(429).json({ error: "S'ha superat el límit d'enviaments per minut. Si us plau, espereu un moment." });
      }

      const body = req.body || {};

      // Load SMTP credentials STRICTLY from process.env (never from client or database settings)
      const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
      const smtpPort = process.env.SMTP_PORT || '587';
      const smtpUser = process.env.SMTP_USER || '';
      const smtpPassword = process.env.SMTP_PASSWORD || '';
      const smtpFrom = process.env.SMTP_FROM || process.env.SMTP_USER || '';

      if (!smtpPassword || !smtpUser) {
        return res.status(500).json({ error: "La configuració SMTP del servidor no està completa (SMTP_USER / SMTP_PASSWORD absents en entorn)." });
      }

      // Extract values based on payload format
      let to = "";
      let subject = "Confirmació d'inscripció - El Tast 2027";
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
              <p>La teva inscripció s'ha realitzat correctament per a l'edició 2027.</p>
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
        return res.status(400).json({ error: "Falten camps obligatoris (destinatari o contingut HTML)" });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(to.trim())) {
        return res.status(400).json({ error: "L'adreça de correu de destinació no té un format vàlid." });
      }

      // Process attachments for Nodemailer
      let mailAttachments: any[] = [];
      if (attachments && Array.isArray(attachments)) {
        mailAttachments = attachments.map((att: any) => {
          if (att.content && typeof att.content === 'string' && att.content.startsWith('data:')) {
            const matches = att.content.match(/^data:(.+);base64,(.+)$/);
            if (matches) {
              const base64Data = matches[2];
              return {
                filename: att.filename || "image.png",
                content: Buffer.from(base64Data, 'base64'),
                cid: att.cid || undefined
              };
            }
          }
          return {
            filename: att.filename,
            content: att.content,
            path: att.path,
            cid: att.cid || att.content_id || undefined
          };
        });
      }

      // Create Nodemailer Transporter with secure TLS enforcement
      const isPort465 = smtpPort === '465';
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: parseInt(smtpPort, 10),
        secure: isPort465,
        auth: {
          user: smtpUser,
          pass: smtpPassword,
        },
      });

      const mailOptions = {
        from: `"${process.env.SMTP_SENDER_NAME || 'Inscripcions El Tast'}" <${smtpFrom}>`,
        to,
        subject,
        html,
        attachments: mailAttachments.length > 0 ? mailAttachments : undefined,
      };

      const info = await transporter.sendMail(mailOptions);

      return res.json({
        success: true,
        id: info.messageId,
        messageId: info.messageId
      });
    } catch (error: any) {
      console.error("Error sending email via Nodemailer SMTP (Express):", error?.message || error);
      return res.status(500).json({
        error: error.message || "Error al enviar el correo a través de SMTP."
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
      const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress || 'unknown';
      if (!checkRateLimit(`trans_${clientIp}`, 30, 60 * 1000)) {
        return res.status(429).json({ error: "Límit de traduccions excedit. Espereu uns segons." });
      }

      const { text, target_language, q, source, target } = req.body;
      const textToTranslate = text || q || "";
      const targetLang = target_language || target || "es";
      const sourceLang = source || "ca";

      if (!textToTranslate.trim()) {
        return res.json({ translatedText: "" });
      }

      if (textToTranslate.length > 5000) {
        return res.status(400).json({ error: "El text supera el límit màxim permès de 5000 caràcters." });
      }

      // Bypass LibreTranslate and go straight to Gemini for high-speed, reliable translations
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        console.warn("[Translation Proxy] GEMINI_API_KEY no està definit, retornem text original.");
        return res.json({ translatedText: textToTranslate }); 
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

      const targetName = targetLang === 'ca' ? 'Catalan' : 'Spanish';

      let prompt = '';
      if (sourceLang === 'auto') {
        prompt = `You are a professional Catalan-Spanish bilingual translator.
Analyze the following text and determine its language (Catalan or Spanish).
- If the text is already in ${targetName}, return it exactly as is.
- If the text is in the other language, translate it into ${targetName}.
Ensure you preserve any formatting, capitalizations, emoji, or style.
CRITICAL MANDATE: Never translate the word "Tast" or "El Tast". Keep the proper name "Tast" or "El Tast" exactly as is in the output text, without converting it to any other word.
Return ONLY the clean text, without preamble, thoughts, warnings, explanations, quotes, or markdown tags unless they were in the original.
Text: "${textToTranslate}"`;
      } else {
        const sourceName = sourceLang === 'ca' ? 'Catalan' : 'Spanish';
        prompt = `You are a professional Catalan-Spanish bilingual translator.
Translate the following text from ${sourceName} into ${targetName}.
Ensure you preserve any formatting, capitalizations, emoji, or style.
CRITICAL MANDATE: Never translate the word "Tast" or "El Tast". Keep the proper name "Tast" or "El Tast" exactly as is in the output text, without converting it to any other word.
Return ONLY the clean translated text, without preamble, thoughts, warnings, explanations, quotes, or markdown tags unless they were in the original.
Text: "${textToTranslate}"`;
      }

      const response = await aiClient.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          temperature: 0.1,
        }
      });

      let translatedText = response.text || "";
      translatedText = translatedText.trim();
      if (translatedText.startsWith('"') && translatedText.endsWith('"') && !textToTranslate.startsWith('"')) {
        translatedText = translatedText.substring(1, translatedText.length - 1);
      }

      console.log(`[Translation Proxy] Gemini success: "${translatedText.substring(0, 30)}..."`);
      return res.json({ translatedText: translatedText.trim() });
    } catch (error: any) {
      const errMsg = error?.message || String(error);
      const isQuota = errMsg.includes("429") || errMsg.includes("503") || errMsg.includes("quota") || errMsg.includes("RESOURCE_EXHAUSTED") || errMsg.includes("UNAVAILABLE");
      
      if (isQuota) {
        console.warn("[Translation Proxy] Gemini quota exceeded. Bypassing translations gracefully.");
        return res.status(429).json({ 
          error: "quota_exceeded", 
          translatedText: req.body.text || req.body.q || "" 
        });
      }
      
      console.error("[Translation Proxy] Error in translation API:", error);
      return res.status(500).json({ 
        error: "translation_failed", 
        translatedText: req.body.text || req.body.q || "" 
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

startServer().catch((err) => {
  console.error("Critical error in startServer:", err);
  process.exit(1);
});
