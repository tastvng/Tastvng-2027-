import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";

export async function POST(request: Request) {
  try {
    const body = await request.json();

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
    console.log('=== DEBUG (App Router): Nodemailer SMTP Config ===');
    console.log('Host:', smtpHost);
    console.log('Port:', smtpPort);
    console.log('User:', smtpUser);
    console.log('From:', smtpFrom);
    console.log('Password set:', !!smtpPassword);
    console.log('=== FIN DEBUG ===');

    if (!smtpPassword) {
      console.error("[Nodemailer App Router Error] SMTP password is empty or not defined.");
      return new Response(
        JSON.stringify({ error: "La contrasenya de l'SMTP no està configurada al servidor." }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
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
      console.error("[Nodemailer App Router Error] Missing required fields (to, html).");
      return new Response(
        JSON.stringify({ error: "Falten camps obligatoris (destinatari o contingut HTML)" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
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
    console.log("Email sent successfully through Nodemailer SMTP (App Router):", info.messageId);

    return new Response(
      JSON.stringify({
        success: true,
        id: info.messageId,
        messageId: info.messageId
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error sending email via Nodemailer SMTP (App Router):", error);
    return new Response(
      JSON.stringify({
        error: error.message || "Error al enviar el correo a través de SMTP."
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
