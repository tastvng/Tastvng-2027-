import type { VercelRequest, VercelResponse } from "@vercel/node";

const ALLOWED_ORIGINS = [
  'https://tastvng-2027.vercel.app',
  'https://tastvng-2027-.vercel.app',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173'
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin as string;
  if (origin) {
    const isAllowed = 
      ALLOWED_ORIGINS.includes(origin) ||
      origin === process.env.APP_URL ||
      origin === `http://${req.headers.host}` ||
      origin === `https://${req.headers.host}`;

    if (isAllowed) {
      res.setHeader("Access-Control-Allow-Origin", origin);
    }
  }

  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");

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
