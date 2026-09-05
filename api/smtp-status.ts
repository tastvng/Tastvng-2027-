import type { VercelRequest, VercelResponse } from "@vercel/node";
import { applyCorsHeaders } from "./_cors";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyCorsHeaders(req as any, res as any, "GET, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = process.env.SMTP_PORT || '587';
  const user = process.env.SMTP_USER || '';
  const from = process.env.SMTP_FROM || process.env.SMTP_USER || '';
  const configured = !!(process.env.SMTP_PASSWORD && process.env.SMTP_USER);

  return res.status(200).json({
    configured,
    host,
    port,
    user: user ? user.replace(/^(.{2})(.*)(@.*)$/, '$1***$3') : '',
    from: from ? from.replace(/^(.{2})(.*)(@.*)$/, '$1***$3') : '',
    provider: 'Server Environment Variables (Secure)'
  });
}
