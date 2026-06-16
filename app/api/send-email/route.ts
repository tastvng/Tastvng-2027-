import nodemailer from "nodemailer";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { smtpConfig, emailData } = body;

    if (!emailData) {
      console.error("[Vercel App Router Error] Missing 'emailData' in request body.");
      return new Response(
        JSON.stringify({ error: "Faltat paràmetre emailData" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const host = smtpConfig?.host || process.env.SMTP_HOST;
    const port = smtpConfig?.port || process.env.SMTP_PORT;
    const user = smtpConfig?.user || process.env.SMTP_USER;
    const pass = smtpConfig?.pass || process.env.SMTP_PASSWORD;
    const senderName = smtpConfig?.senderName || process.env.SMTP_SENDER_NAME || "Inscripcions El Tast";

    const { to, subject, html, attachments } = emailData;

    if (!host || !port || !user || !pass) {
      const missingVars = [];
      if (!host) missingVars.push("SMTP_HOST");
      if (!port) missingVars.push("SMTP_PORT");
      if (!user) missingVars.push("SMTP_USER");
      if (!pass) missingVars.push("SMTP_PASSWORD");

      console.error("[Vercel App Router Error] Missing server SMTP environment variables or smtpConfig:", missingVars);
      return new Response(
        JSON.stringify({ 
          error: `Falten les següents variables d'entorn del servidor per a realitzar l'enviament SMTP: ${missingVars.join(", ")}` 
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!to || !subject || !html) {
      console.error("[Vercel App Router Error] Missing required email fields (to, subject, or html) inside emailData.");
      return new Response(
        JSON.stringify({ error: "Falten camps obligatoris del correu (to, subject o html)" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const portNum = parseInt(port, 10);
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
        rejectUnauthorized: false
      }
    });

    const mailOptions: any = {
      from: `"${senderName || 'Inscripcions El Tast'}" <${user}>`,
      to,
      subject,
      html,
    };

    if (attachments && Array.isArray(attachments)) {
      mailOptions.attachments = attachments.map((att: any) => {
        if (att.content && typeof att.content === 'string' && att.content.startsWith('data:')) {
          const matches = att.content.match(/^data:(.+);base64,(.+)$/);
          if (matches) {
            const contentType = matches[1];
            const base64Data = matches[2];
            return {
              filename: att.filename || "image.png",
              content: Buffer.from(base64Data, 'base64'),
              contentType,
              cid: att.cid
            };
          }
        }
        return att;
      });
    }

    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent successfully through SMTP server:", info.messageId);

    return new Response(
      JSON.stringify({
        success: true,
        messageId: info.messageId,
        response: info.response
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error sending email via nodemailer:", error);
    return new Response(
      JSON.stringify({
        error: error.message || "Error al enviar el correo a través de SMTP."
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
