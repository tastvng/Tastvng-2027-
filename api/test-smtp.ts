import nodemailer from "nodemailer";

export default async function handler(req: any, res: any) {
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

    return res.status(200).json({
      success: true,
      messageId: info.messageId,
      response: info.response
    });
  } catch (error: any) {
    console.error("Error sending email via nodemailer serverless:", error);
    return res.status(500).json({
      error: error.message || "Error al enviar el correo a través de SMTP."
    });
  }
}
