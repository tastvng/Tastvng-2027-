import express from "express";
import path from "path";
import nodemailer from "nodemailer";
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

  // API Route to send a real SMTP email
  app.post("/api/send-email", async (req, res) => {
    try {
      const { smtpConfig, emailData } = req.body;
      if (!smtpConfig || !emailData) {
        return res.status(400).json({ error: "Falten paràmetres smtpConfig o emailData" });
      }

      const { host, port, user, pass, senderName } = smtpConfig;
      const { to, subject, html, attachments } = emailData;

      if (!host || !port || !user || !pass || !to || !subject || !html) {
        return res.status(400).json({ error: "Falten camps obligatoris de la configuració SMTP o del correu" });
      }

      const portNum = parseInt(port, 10);
      
      // Determine security (TLS/SSL) depending on standard ports
      // Port 465 typically uses SSL/TLS direct connection from the start, so secure: true
      // Port 587 uses STARTTLS upgrade from clear text, so secure: false
      const secure = portNum === 465;

      const transporter = nodemailer.createTransport({
        host,
        port: portNum,
        secure,
        auth: {
          user,
          pass,
        },
        tls: {
          // Do not fail on invalid/self-signed SSL certificates (common with association servers)
          rejectUnauthorized: false
        }
      });

      // Base email options
      const mailOptions: any = {
        from: `"${senderName || 'Inscripcions El Tast'}" <${user}>`,
        to,
        subject,
        html,
      };

      // Handle attachments if specified
      if (attachments && Array.isArray(attachments)) {
        mailOptions.attachments = attachments.map((att: any) => {
          // Handle base64 image strings (e.g. inline QR codes or general attachments)
          if (att.content && typeof att.content === 'string' && att.content.startsWith('data:')) {
            const matches = att.content.match(/^data:(.+);base64,(.+)$/);
            if (matches) {
              const contentType = matches[1];
              const base64Data = matches[2];
              return {
                filename: att.filename || "image.png",
                content: Buffer.from(base64Data, 'base64'),
                contentType,
                cid: att.cid // If we want to reference it as <img src="cid:uq-qr-id" />
              };
            }
          }
          return att;
        });
      }

      const info = await transporter.sendMail(mailOptions);
      console.log("Email sent successfully through SMTP server:", info.messageId);
      
      return res.json({ 
        success: true, 
        messageId: info.messageId,
        response: info.response 
      });
    } catch (error: any) {
      console.error("Error sending email via nodemailer:", error);
      return res.status(500).json({ 
        error: error.message || "Error al enviar el correo a través de SMTP." 
      });
    }
  });

  // Base API healthcheck endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: new Date() });
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
