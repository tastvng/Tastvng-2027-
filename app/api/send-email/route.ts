import { Resend } from "resend";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const apiKey = process.env.RESEND_API_KEY;

    if (!apiKey) {
      console.error("[Vercel App Router Error] RESEND_API_KEY environment variable is not defined.");
      return new Response(
        JSON.stringify({ error: "La clau de l'API de Resend (RESEND_API_KEY) no està configurada al servidor." }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
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
      console.error("[Vercel App Router Error] Missing required fields (to, html).");
      return new Response(
        JSON.stringify({ error: "Falten camps obligatoris (destinatari o contingut HTML)" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
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
      console.error("[Vercel App Router Error] Resend API error:", response.error);
      return new Response(
        JSON.stringify({ error: response.error.message }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log("Email sent successfully through Resend:", response.data?.id);

    return new Response(
      JSON.stringify({
        success: true,
        id: response.data?.id,
        messageId: response.data?.id
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error sending email via Resend:", error);
    return new Response(
      JSON.stringify({
        error: error.message || "Error al enviar el correo a través de Resend."
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
