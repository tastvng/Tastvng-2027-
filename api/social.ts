import type { IncomingMessage, ServerResponse } from "http";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { verifySupabaseAdminToken } from "./_supabase-auth.js";

interface ExtendedRequest extends IncomingMessage {
  query?: Record<string, string | string[]>;
  body?: any;
}

interface ExtendedResponse extends ServerResponse {
  status?: (code: number) => ExtendedResponse;
  json?: (data: any) => void;
  send?: (data: any) => void;
}

// -------------------------------------------------------------
// CORS & Security Headers
// -------------------------------------------------------------
function applyCors(req: ExtendedRequest, res: ExtendedResponse) {
  const origin = (req.headers.origin as string) || "https://tastvng-2027.vercel.app";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
  res.setHeader("X-Content-Type-Options", "nosniff");
}

// -------------------------------------------------------------
// Admin Verification using Supabase
// -------------------------------------------------------------
async function verifyAdmin(req: ExtendedRequest): Promise<boolean> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return false;
  }
  const token = authHeader.substring(7).trim();
  if (!token) return false;

  try {
    const result = await verifySupabaseAdminToken(token);
    return !!result.valid;
  } catch (err) {
    console.error("[api/social] Error verifying admin token:", err);
    return false;
  }
}

// -------------------------------------------------------------
// Encryption Helpers (AES-256-GCM)
// -------------------------------------------------------------
function getEncryptionKey(): Buffer {
  const secret = process.env.META_ENCRYPTION_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "tastvng_meta_default_secure_vault_key_2027";
  return crypto.createHash("sha256").update(secret).digest();
}

function encryptData(text: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

function decryptData(encryptedStr: string): string | null {
  try {
    const parts = encryptedStr.split(":");
    if (parts.length !== 3) return null;
    const [ivHex, authTagHex, encryptedText] = parts;
    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, "hex");
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
    let decrypted = decipher.update(encryptedText, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (err) {
    console.error("[api/social] Error decrypting token vault:", err);
    return null;
  }
}

// -------------------------------------------------------------
// Supabase Service Role Client
// -------------------------------------------------------------
function getSupabaseAdmin() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !serviceKey) return null;
  return createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
}

// -------------------------------------------------------------
// Stored Token Vault Structure (Independent FB & IG branches)
// -------------------------------------------------------------
interface MetaTokenVault {
  // Facebook Branch
  facebook?: {
    pageAccessToken: string;
    pageId: string;
    pageName: string;
    userAccessToken?: string;
    expiresAt?: number;
    updatedAt: string;
  };
  // Instagram Branch
  instagram?: {
    accessToken: string;
    userId: string;
    username: string;
    expiresAt?: number;
    updatedAt: string;
  };
  // Backwards compatibility properties
  pageAccessToken?: string;
  pageId?: string;
  pageName?: string;
  igId?: string;
  igUsername?: string;
  igAccessToken?: string;
  userAccessToken?: string;
  expiresAt?: number;
  updatedAt: string;
}

async function getVault(): Promise<MetaTokenVault | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "meta_auth_vault_enc")
      .maybeSingle();

    if (error || !data || !data.value) return null;
    const decrypted = decryptData(typeof data.value === "string" ? data.value : JSON.stringify(data.value));
    if (!decrypted) return null;
    return JSON.parse(decrypted) as MetaTokenVault;
  } catch (e) {
    console.error("[api/social] Exception reading vault:", e);
    return null;
  }
}

async function saveVault(vault: MetaTokenVault): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return false;

  try {
    const encrypted = encryptData(JSON.stringify(vault));
    const { error } = await supabase
      .from("settings")
      .upsert({
        key: "meta_auth_vault_enc",
        value: encrypted,
        updated_at: new Date().toISOString()
      }, { onConflict: "key" });

    if (error) {
      console.warn("[api/social] Upsert to settings failed, trying sistema_config:", error.message);
      await supabase
        .from("sistema_config")
        .upsert({
          clau: "meta_auth_vault_enc",
          valor: { payload: encrypted },
          actualitzat_en: new Date().toISOString()
        }, { onConflict: "clau" });
    }
    return true;
  } catch (e) {
    console.error("[api/social] Error saving vault:", e);
    return false;
  }
}

async function clearVault(): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return false;
  try {
    await supabase.from("settings").delete().eq("key", "meta_auth_vault_enc");
    await supabase.from("sistema_config").delete().eq("clau", "meta_auth_vault_enc");
    return true;
  } catch (e) {
    return false;
  }
}

// Helper to format ISO date to readable string
function formatRelativeDate(isoStr: string): string {
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return "Recent";
    const now = new Date();
    const diffHours = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60));
    if (diffHours < 1) return "Fa pocs minuts";
    if (diffHours < 24) return `Fa ${diffHours} hores`;
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return "Recent";
  }
}

// -------------------------------------------------------------
// MAIN SERVERLESS HANDLER
// -------------------------------------------------------------
export default async function socialHandler(req: ExtendedRequest, res: ExtendedResponse) {
  applyCors(req, res);

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  // Parse query params safely
  const urlObj = new URL(req.url || "", "http://localhost:3000");
  const rawAction = (urlObj.searchParams.get("action") || (req.query?.action as string) || "").toLowerCase();
  const oauthState = urlObj.searchParams.get("state") || "";
  const hasOAuthReturn = !rawAction && !!urlObj.searchParams.get("code") && /^(ig|fb):/.test(oauthState);
  const action = rawAction || (hasOAuthReturn ? "callback" : "");

  const sendJson = (statusCode: number, payload: any) => {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.writeHead(statusCode);
    res.end(JSON.stringify(payload));
  };

  // ===========================================================
  // 1. GET AUTH URL (Admin only - Separated FB & IG)
  // ===========================================================
  if (action === "auth-url") {
    const isAdmin = await verifyAdmin(req);
    if (!isAdmin) {
      return sendJson(403, { error: "Accés no autoritzat. Requerix rol Administrador." });
    }

    const host = req.headers["x-forwarded-host"] || req.headers.host || "tastvng-2027.vercel.app";
    const proto = req.headers["x-forwarded-proto"] || "https";
    const defaultRedirect = `${proto}://${host}/api/social?action=callback`;
    const redirectUri = process.env.META_REDIRECT_URI || defaultRedirect;

    const platform = (urlObj.searchParams.get("platform") || (req.query?.platform as string) || "facebook").toLowerCase();

    // ---------------------------------------------
    // INSTAGRAM BUSINESS LOGIN
    // ---------------------------------------------
    if (platform === "instagram") {
      const igAppId = process.env.INSTAGRAM_APP_ID;
      if (!igAppId) {
        return sendJson(500, {
          error: "INSTAGRAM_APP_ID no està configurat a les variables d'entorn.",
          configured: false
        });
      }

      const igRedirectUri = `${proto}://${host}/api/social`;

      // Secure state prefixed with 'ig:'
      const state = "ig:" + crypto.randomBytes(16).toString("hex");

      // Official Instagram Business Login dialog
      const authUrl = `https://www.instagram.com/oauth/authorize?client_id=${encodeURIComponent(igAppId)}&redirect_uri=${encodeURIComponent(igRedirectUri)}&response_type=code&scope=instagram_business_basic&state=${encodeURIComponent(state)}`;

      return sendJson(200, {
        ok: true,
        platform: "instagram",
        authUrl,
        redirectUri: igRedirectUri,
        state
      });
    }

    // ---------------------------------------------
    // FACEBOOK LOGIN (Page Reading Scopes Only)
    // ---------------------------------------------
    const appId = process.env.META_APP_ID;
    if (!appId) {
      return sendJson(500, {
        error: "META_APP_ID no està configurat a les variables d'entorn del servidor (Vercel).",
        configured: false
      });
    }

    // Secure state prefixed with 'fb:'
    const state = "fb:" + crypto.randomBytes(16).toString("hex");

    // Strictly Page reading scopes - NO Instagram scopes here to avoid use-case conflicts
    const fbScopes = "pages_show_list,pages_read_engagement,pages_read_user_content";

    const authUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${encodeURIComponent(appId)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}&scope=${encodeURIComponent(fbScopes)}&response_type=code`;

    return sendJson(200, {
      ok: true,
      platform: "facebook",
      authUrl,
      redirectUri,
      state
    });
  }

  // ===========================================================
  // 2. OAUTH CALLBACK (From Meta redirect - FB or IG)
  // ===========================================================
  if (action === "callback") {
    const rawCode = urlObj.searchParams.get("code") || "";
    // Instagram sometimes appends #_ to the redirect URI
    const code = rawCode.replace(/#_$/, "");
    const state = urlObj.searchParams.get("state") || "";
    const errorCode = urlObj.searchParams.get("error_code") || urlObj.searchParams.get("error") || "";
    const errorMessage = urlObj.searchParams.get("error_message") || urlObj.searchParams.get("error_description") || "";
    const errorParam = urlObj.searchParams.get("error") || urlObj.searchParams.get("error_code");
    const errorDesc = urlObj.searchParams.get("error_description") || urlObj.searchParams.get("error_message");

    if (errorParam || !code) {
      const keys = Array.from(urlObj.searchParams.keys());
      let refererHost = "";
      try {
        const rawReferer = (req.headers.referer as string) || "";
        if (rawReferer) {
          refererHost = new URL(rawReferer).hostname;
        }
      } catch {
        refererHost = "";
      }

      console.warn("[api/social] callback sin code. keys:", keys, "method:", req.method, "error_code:", errorCode, "error_message:", errorMessage);

      const escapeHtml = (str: string) =>
        String(str)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;");

      const safeErrorMsg = escapeHtml(errorMessage || errorDesc || errorParam || "Codi d'autorització no rebut");
      const safeErrorCode = errorCode ? `Codi: ${escapeHtml(errorCode)}` : "";
      const safeKeysList = escapeHtml(keys.length > 0 ? keys.join(", ") : "(cap)");
      const safeMethod = escapeHtml(req.method || "GET");
      const safeReferer = refererHost ? ` | Referer: ${escapeHtml(refererHost)}` : "";

      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.writeHead(400);
      res.end(`
        <!DOCTYPE html>
        <html>
        <head><title>Error d'autorització</title></head>
        <body style="font-family:sans-serif; text-align:center; padding:40px; background:#121212; color:#fff;">
          <h2 style="color:#ef4444;">Error en l'autorització</h2>
          ${safeErrorCode ? `<p style="color:#f87171; font-weight:bold; font-size:14px; margin-bottom:4px;">${safeErrorCode}</p>` : ""}
          <p style="color:#a1a1aa;">${safeErrorMsg}</p>
          <p style="color:#71717a; font-size:12px; font-family:monospace; margin-top:16px;">Paràmetres rebuts: ${safeKeysList} | Mètode: ${safeMethod}${safeReferer}</p>
          <button onclick="window.close()" style="background:#ff0090; color:#fff; border:none; padding:10px 20px; border-radius:8px; cursor:pointer; font-weight:bold; margin-top:20px;">Tancar finestra</button>
        </body>
        </html>
      `);
      return;
    }

    const host = req.headers["x-forwarded-host"] || req.headers.host || "tastvng-2027.vercel.app";
    const proto = req.headers["x-forwarded-proto"] || "https";
    const defaultRedirect = `${proto}://${host}/api/social?action=callback`;
    const redirectUri = process.env.META_REDIRECT_URI || defaultRedirect;

    // Secure discrimination by state prefix
    const isFacebook = state.startsWith("fb:");
    const isInstagram = state.startsWith("ig:");

    if (!isFacebook && !isInstagram) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.writeHead(400);
      res.end(`
        <!DOCTYPE html>
        <html>
        <head><title>Error d'Estat</title></head>
        <body style="font-family:sans-serif; text-align:center; padding:40px; background:#121212; color:#fff;">
          <h2 style="color:#ef4444;">Paràmetre d'estat invàlid</h2>
          <p style="color:#a1a1aa;">No s'ha pogut verificar l'origen de la petició OAuth.</p>
          <button onclick="window.close()" style="background:#ff0090; color:#fff; border:none; padding:10px 20px; border-radius:8px; cursor:pointer; font-weight:bold;">Tancar</button>
        </body>
        </html>
      `);
      return;
    }

    // ---------------------------------------------------------
    // A. INSTAGRAM CALLBACK FLOW
    // ---------------------------------------------------------
    if (isInstagram) {
      const igAppId = process.env.INSTAGRAM_APP_ID;
      const igAppSecret = process.env.INSTAGRAM_APP_SECRET;

      if (!igAppId || !igAppSecret) {
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.writeHead(500);
        res.end("<h3>Variables INSTAGRAM_APP_ID o INSTAGRAM_APP_SECRET no configurades</h3>");
        return;
      }

      const igRedirectUri = `${proto}://${host}/api/social`;

      try {
        // Step 1: Exchange code for short-lived token via POST
        const tokenParams = new URLSearchParams();
        tokenParams.append("client_id", igAppId);
        tokenParams.append("client_secret", igAppSecret);
        tokenParams.append("grant_type", "authorization_code");
        tokenParams.append("redirect_uri", igRedirectUri);
        tokenParams.append("code", code);

        const tokenRes = await fetch("https://api.instagram.com/oauth/access_token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: tokenParams.toString()
        });
        const tokenData = await tokenRes.json();

        if (tokenData.error_message || tokenData.error) {
          throw new Error(tokenData.error_message || tokenData.error?.message || "Error canviant codi d'Instagram");
        }

        const shortLivedToken = tokenData.access_token;
        const userId = String(tokenData.user_id || "");

        // Step 2: Exchange for long-lived Instagram token (60 days)
        const longLivedUrl = `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${encodeURIComponent(igAppSecret)}&access_token=${encodeURIComponent(shortLivedToken)}`;
        const longRes = await fetch(longLivedUrl);
        const longData = await longRes.json();
        const longLivedToken = longData.access_token || shortLivedToken;

        // Step 3: Fetch Instagram username & details
        let igUsername = "tastvng";
        try {
          const profileRes = await fetch(`https://graph.instagram.com/v19.0/me?fields=id,username,account_type&access_token=${encodeURIComponent(longLivedToken)}`);
          const profileData = await profileRes.json();
          if (profileData && profileData.username) {
            igUsername = profileData.username;
          }
        } catch (pErr) {
          console.warn("[api/social] Error fetching IG username:", pErr);
        }

        // Step 4: Update Vault preserving existing Facebook credentials
        const existingVault: MetaTokenVault = (await getVault()) || {
          updatedAt: new Date().toISOString()
        };

        existingVault.instagram = {
          accessToken: longLivedToken,
          userId: userId || existingVault.igId || "tastvng",
          username: igUsername,
          expiresAt: Date.now() + (60 * 24 * 60 * 60 * 1000),
          updatedAt: new Date().toISOString()
        };

        // Update legacy flat props for backwards compatibility
        existingVault.igAccessToken = longLivedToken;
        existingVault.igId = userId || existingVault.igId;
        existingVault.igUsername = igUsername;
        existingVault.updatedAt = new Date().toISOString();

        await saveVault(existingVault);

        // Perform initial sync in background
        try {
          await executeMetaSync(existingVault);
        } catch (syncErr) {
          console.warn("[api/social] Initial IG sync warning:", syncErr);
        }

        // Return Success Page
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.writeHead(200);
        res.end(`
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <title>Connexió Instagram Completada</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #09090b; color: #f4f4f5; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
              .card { background: #18181b; border: 1px solid #27272a; border-radius: 24px; padding: 32px; max-width: 400px; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }
              h2 { color: #e1306c; margin-top: 0; }
              p { color: #a1a1aa; font-size: 14px; line-height: 1.5; }
              .btn { background: linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888); color: #fff; border: none; padding: 12px 24px; border-radius: 12px; font-weight: bold; cursor: pointer; text-decoration: none; display: inline-block; margin-top: 16px; }
            </style>
          </head>
          <body>
            <div class="card">
              <h2>✓ Connexió amb Instagram correcta!</h2>
              <p>S'ha vinculat oficialment el compte <strong>@${igUsername}</strong> per a la lectura del canal d'avisos.</p>
              <p>Ja pots tancar aquesta finestra i tornar al panell de control.</p>
              <button class="btn" onclick="finish()">Finalitzar i Tancar</button>
            </div>
            <script>
              function finish() {
                if (window.opener) {
                  window.opener.postMessage({ type: 'META_AUTH_SUCCESS', platform: 'instagram', username: '${igUsername}' }, '*');
                }
                window.close();
              }
              setTimeout(finish, 2200);
            </script>
          </body>
          </html>
        `);
        return;
      } catch (err: any) {
        console.error("[api/social] Instagram callback exception:", err);
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.writeHead(500);
        res.end(`
          <!DOCTYPE html>
          <html>
          <head><title>Error Instagram</title></head>
          <body style="font-family:sans-serif; text-align:center; padding:40px; background:#121212; color:#fff;">
            <h2 style="color:#ef4444;">Error vinculant Instagram</h2>
            <p style="color:#a1a1aa;">${err?.message || "Error desconegut"}</p>
            <button onclick="window.close()" style="background:#ff0090; color:#fff; border:none; padding:10px 20px; border-radius:8px; cursor:pointer; font-weight:bold;">Tancar</button>
          </body>
          </html>
        `);
        return;
      }
    }

    // ---------------------------------------------------------
    // B. FACEBOOK CALLBACK FLOW
    // ---------------------------------------------------------
    if (isFacebook) {
      const appId = process.env.META_APP_ID;
      const appSecret = process.env.META_APP_SECRET;

      if (!appId || !appSecret) {
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.writeHead(500);
        res.end("<h3>Variables META_APP_ID o META_APP_SECRET no configurades</h3>");
        return;
      }

      try {
        // Step 1: Exchange code for short-lived user token
        const tokenUrl = `https://graph.facebook.com/v19.0/oauth/access_token?client_id=${encodeURIComponent(appId)}&client_secret=${encodeURIComponent(appSecret)}&redirect_uri=${encodeURIComponent(redirectUri)}&code=${encodeURIComponent(code)}`;
        const tokenRes = await fetch(tokenUrl);
        const tokenData = await tokenRes.json();

        if (tokenData.error) {
          throw new Error(tokenData.error.message || "Error canviant codi d'accés de Facebook");
        }

        const shortLivedToken = tokenData.access_token;

        // Step 2: Exchange for long-lived user token (60 days)
        const longLivedUrl = `https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${encodeURIComponent(appId)}&client_secret=${encodeURIComponent(appSecret)}&fb_exchange_token=${encodeURIComponent(shortLivedToken)}`;
        const longRes = await fetch(longLivedUrl);
        const longData = await longRes.json();
        const longLivedUserToken = longData.access_token || shortLivedToken;

        // Step 3: Discover Facebook Pages
        const accountsUrl = `https://graph.facebook.com/v19.0/me/accounts?fields=id,name,access_token&access_token=${encodeURIComponent(longLivedUserToken)}`;
        const accountsRes = await fetch(accountsUrl);
        const accountsData = await accountsRes.json();

        if (accountsData.error) {
          throw new Error(accountsData.error.message || "Error obtenint pàgines de Facebook");
        }

        const pages = accountsData.data || [];
        if (pages.length === 0) {
          throw new Error("No s'ha trobat cap pàgina de Facebook gestionada pel compte.");
        }

        // Prioritize page named 'El Tast' or select first available
        const tastPage = pages.find((p: any) => /tast/i.test(p.name)) || pages[0];
        const pageAccessToken = tastPage.access_token;
        const pageId = tastPage.id;
        const pageName = tastPage.name;

        // Step 4: Update Vault preserving existing Instagram credentials
        const existingVault: MetaTokenVault = (await getVault()) || {
          updatedAt: new Date().toISOString()
        };

        existingVault.facebook = {
          pageAccessToken,
          pageId,
          pageName,
          userAccessToken: longLivedUserToken,
          expiresAt: Date.now() + (60 * 24 * 60 * 60 * 1000),
          updatedAt: new Date().toISOString()
        };

        // Update legacy flat props for backwards compatibility
        existingVault.pageAccessToken = pageAccessToken;
        existingVault.pageId = pageId;
        existingVault.pageName = pageName;
        existingVault.updatedAt = new Date().toISOString();

        await saveVault(existingVault);

        // Perform initial sync in background
        try {
          await executeMetaSync(existingVault);
        } catch (syncErr) {
          console.warn("[api/social] Initial FB sync warning:", syncErr);
        }

        // Return Success Page
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.writeHead(200);
        res.end(`
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <title>Connexió Facebook Completada</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #09090b; color: #f4f4f5; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
              .card { background: #18181b; border: 1px solid #27272a; border-radius: 24px; padding: 32px; max-width: 400px; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }
              h2 { color: #2563eb; margin-top: 0; }
              p { color: #a1a1aa; font-size: 14px; line-height: 1.5; }
              .btn { background: #2563eb; color: #fff; border: none; padding: 12px 24px; border-radius: 12px; font-weight: bold; cursor: pointer; text-decoration: none; display: inline-block; margin-top: 16px; }
            </style>
          </head>
          <body>
            <div class="card">
              <h2>✓ Connexió amb Facebook correcta!</h2>
              <p>S'ha vinculat la pàgina <strong>${pageName}</strong> per a la lectura d'avisos.</p>
              <p>Ja pots tancar aquesta finestra i tornar al panell de control.</p>
              <button class="btn" onclick="finish()">Finalitzar i Tancar</button>
            </div>
            <script>
              function finish() {
                if (window.opener) {
                  window.opener.postMessage({ type: 'META_AUTH_SUCCESS', platform: 'facebook', pageName: '${pageName}' }, '*');
                }
                window.close();
              }
              setTimeout(finish, 2200);
            </script>
          </body>
          </html>
        `);
        return;
      } catch (err: any) {
        console.error("[api/social] Facebook callback exception:", err);
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.writeHead(500);
        res.end(`
          <!DOCTYPE html>
          <html>
          <head><title>Error Facebook</title></head>
          <body style="font-family:sans-serif; text-align:center; padding:40px; background:#121212; color:#fff;">
            <h2 style="color:#ef4444;">Error vinculant Facebook</h2>
            <p style="color:#a1a1aa;">${err?.message || "Error desconegut"}</p>
            <button onclick="window.close()" style="background:#ff0090; color:#fff; border:none; padding:10px 20px; border-radius:8px; cursor:pointer; font-weight:bold;">Tancar</button>
          </body>
          </html>
        `);
        return;
      }
    }
  }

  // ===========================================================
  // 3. STATUS (Admin & Public check - Independent flags)
  // ===========================================================
  if (action === "status") {
    const vault = await getVault();
    const supabase = getSupabaseAdmin();
    let lastSync = "";

    if (supabase) {
      const { data } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "tast_meta_last_sync")
        .maybeSingle();
      if (data && data.value) {
        lastSync = String(data.value);
      }
    }

    const hasFbToken = !!(vault?.facebook?.pageAccessToken || vault?.pageAccessToken);
    const hasIgToken = !!(vault?.instagram?.accessToken || vault?.igAccessToken || (vault?.pageAccessToken && vault?.igId));

    const fbHandle = vault?.facebook?.pageName || vault?.pageName || "Tast vilanoví";
    const igHandle = vault?.instagram?.username
      ? `@${vault.instagram.username}`
      : (vault?.igUsername ? `@${vault.igUsername}` : "@tastvng");

    return sendJson(200, {
      ok: true,
      configured: !!(process.env.META_APP_ID || process.env.INSTAGRAM_APP_ID),
      facebookConnected: hasFbToken,
      instagramConnected: hasIgToken,
      facebookHandle: fbHandle,
      instagramHandle: igHandle,
      lastSync
    });
  }

  // ===========================================================
  // 4. DISCONNECT (Admin only - Platform specific or all)
  // ===========================================================
  if (action === "disconnect") {
    const isAdmin = await verifyAdmin(req);
    if (!isAdmin) {
      return sendJson(403, { error: "Accés no autoritzat." });
    }

    const platform = (urlObj.searchParams.get("platform") || (req.query?.platform as string) || "").toLowerCase();
    const vault = await getVault();

    if (vault) {
      if (platform === "facebook") {
        delete vault.facebook;
        delete vault.pageAccessToken;
        delete vault.pageId;
        delete vault.pageName;
        vault.updatedAt = new Date().toISOString();
        if (vault.instagram?.accessToken || vault.igAccessToken) {
          await saveVault(vault);
        } else {
          await clearVault();
        }
      } else if (platform === "instagram") {
        delete vault.instagram;
        delete vault.igAccessToken;
        delete vault.igId;
        delete vault.igUsername;
        vault.updatedAt = new Date().toISOString();
        if (vault.facebook?.pageAccessToken || vault.pageAccessToken) {
          await saveVault(vault);
        } else {
          await clearVault();
        }
      } else {
        await clearVault();
      }
    }

    return sendJson(200, {
      ok: true,
      message: `Compte oficial ${platform ? platform.toUpperCase() : 'de Meta'} desvinculat correctament.`
    });
  }

  // ===========================================================
  // 5. MANUAL SYNC NOW (Admin only)
  // ===========================================================
  if (action === "sync") {
    const isAdmin = await verifyAdmin(req);
    if (!isAdmin) {
      return sendJson(403, { error: "Accés no autoritzat." });
    }

    const vault = await getVault();
    const hasFbToken = !!(vault?.facebook?.pageAccessToken || vault?.pageAccessToken);
    const hasIgToken = !!(vault?.instagram?.accessToken || vault?.igAccessToken || (vault?.pageAccessToken && vault?.igId));

    if (!vault || (!hasFbToken && !hasIgToken)) {
      return sendJson(400, {
        ok: false,
        error: "No hi ha cap compte de Facebook ni d'Instagram connectat per sincronitzar."
      });
    }

    try {
      const result = await executeMetaSync(vault);
      return sendJson(200, {
        ok: true,
        count: result.count,
        instagramCount: result.instagramCount,
        facebookCount: result.facebookCount,
        totalNoticies: result.totalNoticies,
        lastSync: result.lastSync
      });
    } catch (err: any) {
      console.error("[api/social] Sync error:", err);
      return sendJson(500, {
        ok: false,
        error: err?.message || "Error sincronitzant publicacions"
      });
    }
  }

  // ===========================================================
  // 6. PUBLIC FEED (Cached with background refresh if expired)
  // ===========================================================
  if (action === "feed" || !action) {
    const supabase = getSupabaseAdmin();

    try {
      // Step 1: Read existing consolidated notices from settings
      let currentNoticies: any[] = [];
      let lastSyncTime = 0;

      if (supabase) {
        const { data: nData } = await supabase
          .from("settings")
          .select("value")
          .eq("key", "tast_noticies_2026")
          .maybeSingle();

        if (nData && nData.value) {
          try {
            currentNoticies = typeof nData.value === "string" ? JSON.parse(nData.value) : nData.value;
          } catch {
            currentNoticies = [];
          }
        }

        const { data: sData } = await supabase
          .from("settings")
          .select("value")
          .eq("key", "tast_meta_last_sync_timestamp")
          .maybeSingle();

        if (sData && sData.value) {
          lastSyncTime = Number(sData.value) || 0;
        }
      }

      // Step 2: Auto-refresh check (60 minutes cache duration)
      const ONE_HOUR = 60 * 60 * 1000;
      const isStale = Date.now() - lastSyncTime > ONE_HOUR;

      if (isStale) {
        const vault = await getVault();
        const hasFbToken = !!(vault?.facebook?.pageAccessToken || vault?.pageAccessToken);
        const hasIgToken = !!(vault?.instagram?.accessToken || vault?.igAccessToken || (vault?.pageAccessToken && vault?.igId));

        if (vault && (hasFbToken || hasIgToken)) {
          try {
            const syncResult = await executeMetaSync(vault);
            if (syncResult && Array.isArray(syncResult.noticies)) {
              currentNoticies = syncResult.noticies;
            }
          } catch (autoSyncErr) {
            console.warn("[api/social] Auto-refresh failed, serving cached notices:", autoSyncErr);
          }
        }
      }

      return sendJson(200, {
        ok: true,
        noticies: currentNoticies
      });
    } catch (err: any) {
      console.error("[api/social] Feed exception:", err);
      return sendJson(200, {
        ok: true,
        noticies: []
      });
    }
  }

  return sendJson(404, { error: "Acció desconeguda" });
}

// -------------------------------------------------------------
// CORE SYNC LOGIC (Preserving manual notices & deduplicating)
// -------------------------------------------------------------
async function executeMetaSync(vault: MetaTokenVault): Promise<{
  count: number;
  instagramCount: number;
  facebookCount: number;
  totalNoticies: number;
  lastSync: string;
  noticies: any[];
}> {
  const supabase = getSupabaseAdmin();
  const newMetaPosts: any[] = [];

  // ===========================================================
  // A. FETCH INSTAGRAM MEDIA (Direct Instagram Graph API)
  // ===========================================================
  let instagramCount = 0;
  const igToken = vault.instagram?.accessToken || vault.igAccessToken;
  const igUsername = vault.instagram?.username || vault.igUsername || "tastvng";

  if (igToken) {
    try {
      const igUrl = `https://graph.instagram.com/v19.0/me/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count&limit=12&access_token=${encodeURIComponent(igToken)}`;
      const igRes = await fetch(igUrl);
      const igJson = await igRes.json();

      if (igJson && Array.isArray(igJson.data)) {
        for (const item of igJson.data) {
          if (!item.id) continue;
          const isVideo = item.media_type === "VIDEO";
          const mediaUrl = item.media_url || item.thumbnail_url || "";
          const caption = (item.caption || "").trim();

          newMetaPosts.push({
            id: `meta-ig-${item.id}`,
            xarxa: "instagram",
            usuari: `@${igUsername}`,
            text: caption || `Publicació a Instagram @${igUsername}`,
            imatgeUrl: mediaUrl,
            dataPublicacio: formatRelativeDate(item.timestamp),
            enllacUrl: item.permalink || `https://instagram.com/p/${item.id}`,
            likes: typeof item.like_count === "number" ? item.like_count : 18,
            tipus: isVideo ? "video" : "normal",
            videoUrl: isVideo ? mediaUrl : undefined,
            createdAtTimestamp: new Date(item.timestamp).getTime() || Date.now()
          });
          instagramCount++;
        }
      } else if (igJson?.error) {
        console.warn("[api/social] Instagram Graph API response error:", igJson.error);
      }
    } catch (err) {
      console.warn("[api/social] Error fetching Instagram posts:", err);
    }
  } else if (vault.igId && vault.pageAccessToken) {
    // Fallback: Legacy page-linked Instagram
    try {
      const igUrl = `https://graph.facebook.com/v19.0/${encodeURIComponent(vault.igId)}/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count&limit=12&access_token=${encodeURIComponent(vault.pageAccessToken)}`;
      const igRes = await fetch(igUrl);
      const igJson = await igRes.json();

      if (igJson && Array.isArray(igJson.data)) {
        for (const item of igJson.data) {
          if (!item.id) continue;
          const isVideo = item.media_type === "VIDEO";
          const mediaUrl = item.media_url || item.thumbnail_url || "";
          const caption = (item.caption || "").trim();

          newMetaPosts.push({
            id: `meta-ig-${item.id}`,
            xarxa: "instagram",
            usuari: vault.igUsername ? `@${vault.igUsername}` : "@tastvng",
            text: caption || "Publicació a Instagram @tastvng",
            imatgeUrl: mediaUrl,
            dataPublicacio: formatRelativeDate(item.timestamp),
            enllacUrl: item.permalink || `https://instagram.com/p/${item.id}`,
            likes: typeof item.like_count === "number" ? item.like_count : 18,
            tipus: isVideo ? "video" : "normal",
            videoUrl: isVideo ? mediaUrl : undefined,
            createdAtTimestamp: new Date(item.timestamp).getTime() || Date.now()
          });
          instagramCount++;
        }
      }
    } catch (err) {
      console.warn("[api/social] Error fetching legacy Instagram posts:", err);
    }
  }

  // ===========================================================
  // B. FETCH FACEBOOK POSTS (Facebook Pages API)
  // ===========================================================
  let facebookCount = 0;
  const fbToken = vault.facebook?.pageAccessToken || vault.pageAccessToken;
  const fbPageId = vault.facebook?.pageId || vault.pageId;
  const fbPageName = vault.facebook?.pageName || vault.pageName || "Tast vilanoví";

  if (fbToken && fbPageId) {
    try {
      const fbUrl = `https://graph.facebook.com/v19.0/${encodeURIComponent(fbPageId)}/posts?fields=id,message,created_time,permalink_url,full_picture&limit=12&access_token=${encodeURIComponent(fbToken)}`;
      const fbRes = await fetch(fbUrl);
      const fbJson = await fbRes.json();

      if (fbJson && Array.isArray(fbJson.data)) {
        for (const item of fbJson.data) {
          if (!item.id || !item.message) continue;
          const message = (item.message || "").trim();

          newMetaPosts.push({
            id: `meta-fb-${item.id}`,
            xarxa: "facebook",
            usuari: fbPageName,
            text: message,
            imatgeUrl: item.full_picture || "",
            dataPublicacio: formatRelativeDate(item.created_time),
            enllacUrl: item.permalink_url || `https://facebook.com/${item.id}`,
            likes: 15,
            tipus: "normal",
            createdAtTimestamp: new Date(item.created_time).getTime() || Date.now()
          });
          facebookCount++;
        }
      } else if (fbJson?.error) {
        console.warn("[api/social] Facebook Graph API response error:", fbJson.error);
      }
    } catch (err) {
      console.warn("[api/social] Error fetching Facebook posts:", err);
    }
  }

  // ===========================================================
  // C. READ CURRENT NOTICES & STRICTLY PRESERVE MANUAL NOTICES
  // ===========================================================
  let existingNotices: any[] = [];
  if (supabase) {
    const { data } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "tast_noticies_2026")
      .maybeSingle();

    if (data && data.value) {
      try {
        existingNotices = typeof data.value === "string" ? JSON.parse(data.value) : data.value;
      } catch {
        existingNotices = [];
      }
    }
  }

  // Keep all manual notices created by Secretaria (IDs NOT starting with meta-)
  const manualNotices = existingNotices.filter((n: any) => !n.id || (!n.id.startsWith("meta-ig-") && !n.id.startsWith("meta-fb-")));

  // Combined notices map for clean deduplication
  const combinedMap = new Map<string, any>();

  // Add fresh Meta posts first
  for (const post of newMetaPosts) {
    combinedMap.set(post.id, post);
  }

  // Add existing manual notices (they take priority on their IDs)
  for (const post of manualNotices) {
    combinedMap.set(post.id, post);
  }

  const finalNoticies = Array.from(combinedMap.values()).sort((a, b) => {
    const tA = a.createdAtTimestamp || (a.ressaltat ? 9999999999999 : 0);
    const tB = b.createdAtTimestamp || (b.ressaltat ? 9999999999999 : 0);
    return tB - tA;
  });

  const nowIso = new Date().toISOString();

  // Save back to Supabase settings
  if (supabase) {
    await supabase.from("settings").upsert({
      key: "tast_noticies_2026",
      value: JSON.stringify(finalNoticies),
      updated_at: nowIso
    }, { onConflict: "key" });

    await supabase.from("settings").upsert({
      key: "tast_meta_last_sync",
      value: nowIso,
      updated_at: nowIso
    }, { onConflict: "key" });

    await supabase.from("settings").upsert({
      key: "tast_meta_last_sync_timestamp",
      value: String(Date.now()),
      updated_at: nowIso
    }, { onConflict: "key" });
  }

  return {
    count: newMetaPosts.length,
    instagramCount,
    facebookCount,
    totalNoticies: finalNoticies.length,
    lastSync: nowIso,
    noticies: finalNoticies
  };
}
