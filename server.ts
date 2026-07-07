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

  // API Route to send a real SMTP email (Now via Nodemailer)
  app.post("/api/send-email", async (req, res) => {
    try {
      const body = req.body || {};

      // Initialize Supabase client
      const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
      const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';
      const supabase = (supabaseUrl && supabaseAnonKey) ? createClient(supabaseUrl, supabaseAnonKey) : null;

      // Helper to read setting from Supabase with fallback to process.env or defaults
      const getSupabaseSetting = async (key: string, defaultValue: string): Promise<string> => {
        if (!supabase) return defaultValue;
        try {
          const { data, error } = await supabase
            .from('settings')
            .select('*');
          if (error || !data) return defaultValue;

          const row = data.find((r: any) => (r.key === key || r.id === key));
          if (row) {
            let val = row.value !== undefined ? row.value : row.config !== undefined ? row.config : row.settings !== undefined ? row.settings : row;
            if (typeof val === 'string') {
              try {
                val = JSON.parse(val);
              } catch (e) {}
            }
            return String(val);
          }
        } catch (err) {
          console.error(`Error reading setting ${key} from Supabase:`, err);
        }
        return defaultValue;
      };

      // Load SMTP credentials from Supabase settings (with fallback to env/defaults)
      const smtpHost = await getSupabaseSetting('tast_smtp_host', process.env.SMTP_HOST || 'smtp.gmail.com');
      const smtpPort = await getSupabaseSetting('tast_smtp_port', process.env.SMTP_PORT || '587');
      const smtpUser = await getSupabaseSetting('tast_smtp_usuari', process.env.SMTP_USER || 'tastvng@gmail.com');
      const smtpPassword = await getSupabaseSetting('tast_smtp_contrasenya', process.env.SMTP_PASSWORD || '');
      const smtpFrom = await getSupabaseSetting('tast_smtp_from', process.env.SMTP_USER || 'tastvng@gmail.com');

      // DEBUG: Verify SMTP variables
      console.log('=== DEBUG (Express Server): Nodemailer SMTP Config ===');
      console.log('Host:', smtpHost);
      console.log('Port:', smtpPort);
      console.log('User:', smtpUser);
      console.log('From:', smtpFrom);
      console.log('Password set:', !!smtpPassword);
      console.log('=== FIN DEBUG ===');

      if (!smtpPassword) {
        console.error("[Nodemailer Server Error] SMTP password is empty or not defined.");
        return res.status(500).json({ error: "La contrasenya de l'SMTP no està configurada al servidor." });
      }

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
        console.error("[Nodemailer Server Error] Missing required fields (to, html).");
        return res.status(400).json({ error: "Falten camps obligatoris (destinatari o contingut HTML)" });
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

      // Create Nodemailer Transporter
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: parseInt(smtpPort, 10),
        secure: smtpPort === '465', // true for 465, false for 587 or other ports
        auth: {
          user: smtpUser,
          pass: smtpPassword,
        },
        tls: {
          rejectUnauthorized: false
        }
      });

      const mailOptions = {
        from: `"${process.env.SMTP_SENDER_NAME || 'Inscripcions El Tast'}" <${smtpFrom}>`,
        to,
        subject,
        html,
        attachments: mailAttachments.length > 0 ? mailAttachments : undefined,
      };

      // Send email using Nodemailer
      const info = await transporter.sendMail(mailOptions);
      console.log("Email sent successfully through Nodemailer SMTP:", info.messageId);

      return res.json({
        success: true,
        id: info.messageId,
        messageId: info.messageId
      });
    } catch (error: any) {
      console.error("Error sending email via Nodemailer SMTP (Express):", error);
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
      const { text: bodyText, source, target, q } = req.body;
      const text = bodyText || q || "";
      if (!text || !source || !target) {
        return res.status(400).json({ error: "Falten paràmetres 'text' o 'q', 'source' i 'target'" });
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

startServer().catch((err) => {
  console.error("Critical error in startServer:", err);
  process.exit(1);
});
