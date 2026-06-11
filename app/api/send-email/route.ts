import nodemailer from "nodemailer";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { smtpConfig, emailData } = body;

    if (!smtpConfig || !emailData) {
      return new Response(
        JSON.stringify({ error: "Falten paràmetres smtpConfig o emailData" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const { host, port, user, pass, senderName } = smtpConfig;
    const { to, subject, html, attachments } = emailData;

    if (!host || !port || !user || !pass || !to || !subject || !html) {
      return new Response(
        JSON.stringify({ error: "Falten camps obligatoris de la configuració SMTP o del correu" }),
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
