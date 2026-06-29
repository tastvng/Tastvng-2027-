import { Resend } from "resend";

export default async function handler(req: any, res: any) {
  // DEBUG: Verificar variables de entorno disponibles
  console.log('=== DEBUG: Verificando RESEND_API_KEY ===');
  console.log('RESEND_API_KEY existe:', !!process.env.RESEND_API_KEY);
  console.log('RESEND_API_KEY valor (primeros 10 chars):', process.env.RESEND_API_KEY?.substring(0, 10) + '...');
  console.log('Todas las variables ENV (keys):', Object.keys(process.env).filter(k => k.includes('RESEND') || k.includes('API')));
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('=== FIN DEBUG ===');

  // CORS configuration
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const body = req.body || {};
    const apiKey = process.env.RESEND_API_KEY;

    if (!apiKey) {
      console.error("[Vercel Serverless Error] RESEND_API_KEY environment variable is not defined.");
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
      console.error("[Vercel Serverless Error] Missing required fields (to, html).");
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
      console.error("[Vercel Serverless Error] Resend API error:", response.error);
      return res.status(400).json({ error: response.error.message });
    }

    console.log("Email sent successfully through Resend:", response.data?.id);

    return res.status(200).json({
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
}
