import type { IncomingMessage, ServerResponse } from "http";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

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
    const { verifySupabaseAdminToken } = await import("./_supabase-auth");
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
// Stored Token Vault Structure
// -------------------------------------------------------------
interface MetaTokenVault {
  pageAccessToken: string;
  pageId: string;
  pageName: string;
  igId?: string;
  igUsername?: string;
  userAccessToken?: string;
  expiresAt?: number;
  updatedAt: string;
}

async function getVault(): Promise<MetaTokenVault | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  try {
    // Read from private settings table
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
  const action = (urlObj.searchParams.get("action") || (req.query?.action as string) || "").toLowerCase();

  const sendJson = (statusCode: number, payload: any) => {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.writeHead(statusCode);
    res.end(JSON.stringify(payload));
  };

  // ===========================================================
  // 1. GET AUTH URL (Admin only)
  // ===========================================================
  if (action === "auth-url") {
    const isAdmin = await verifyAdmin(req);
    if (!isAdmin) {
      return sendJson(403, { error: "Accés no autoritzat. Requerix rol Administrador." });
    }

    const appId = process.env.META_APP_ID;
    if (!appId) {
      return sendJson(500, {
        error: "META_APP_ID no està configurat a les variables d'entorn del servidor (Vercel).",
        configured: false
      });
    }

    const host = req.headers["x-forwarded-host"] || req.headers.host || "tastvng-2027.vercel.app";
    const proto = req.headers["x-forwarded-proto"] || "https";
    const defaultRedirect = `${proto}://${host}/api/social?action=callback`;
    const redirectUri = process.env.META_REDIRECT_URI || defaultRedirect;

    // Secure random state
    const state = crypto.randomBytes(16).toString("hex");

    // Scopes strictly necessary for Instagram & Facebook official reading
    const scopes = [
      "pages_show_list",
      "pages_read_engagement",
      "pages_read_user_content",
      "instagram_business_basic"
    ].join(",");

    const authUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${encodeURIComponent(appId)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}&scope=${encodeURIComponent(scopes)}&response_type=code`;

    return sendJson(200, {
      ok: true,
      authUrl,
      redirectUri,
      state
    });
  }

  // ===========================================================
  // 2. OAUTH CALLBACK (From Meta redirect)
  // ===========================================================
  if (action === "callback") {
    const code = urlObj.searchParams.get("code");
    const errorParam = urlObj.searchParams.get("error");
    const errorDesc = urlObj.searchParams.get("error_description");

    if (errorParam || !code) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.writeHead(400);
      res.end(`
        <!DOCTYPE html>
        <html>
        <head><title>Error d'autorització Meta</title></head>
        <body style="font-family:sans-serif; text-align:center; padding:40px; background:#121212; color:#fff;">
          <h2 style="color:#ef4444;">Error en l'autorització amb Meta</h2>
          <p style="color:#a1a1aa;">${errorDesc || errorParam || "Codi d'autorització no rebut"}</p>
          <button onclick="window.close()" style="background:#ff0090; color:#fff; border:none; padding:10px 20px; border-radius:8px; cursor:pointer; font-weight:bold;">Tancar finestra</button>
        </body>
        </html>
      `);
      return;
    }

    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;
    const host = req.headers["x-forwarded-host"] || req.headers.host || "tastvng-2027.vercel.app";
    const proto = req.headers["x-forwarded-proto"] || "https";
    const defaultRedirect = `${proto}://${host}/api/social?action=callback`;
    const redirectUri = process.env.META_REDIRECT_URI || defaultRedirect;

    if (!appId || !appSecret) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.writeHead(500);
      res.end("<h3>Variables META_APP_ID o META_APP_SECRET no configurades</h3>");
      return;
    }

    try {
      // Step A: Exchange code for short-lived user token
      const tokenUrl = `https://graph.facebook.com/v19.0/oauth/access_token?client_id=${encodeURIComponent(appId)}&client_secret=${encodeURIComponent(appSecret)}&redirect_uri=${encodeURIComponent(redirectUri)}&code=${encodeURIComponent(code)}`;
      const tokenRes = await fetch(tokenUrl);
      const tokenData = await tokenRes.json();

      if (tokenData.error) {
        throw new Error(tokenData.error.message || "Error canviant codi d'accés");
      }

      const shortLivedToken = tokenData.access_token;

      // Step B: Exchange for long-lived user token (60 days)
      const longLivedUrl = `https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${encodeURIComponent(appId)}&client_secret=${encodeURIComponent(appSecret)}&fb_exchange_token=${encodeURIComponent(shortLivedToken)}`;
      const longRes = await fetch(longLivedUrl);
      const longData = await longRes.json();
      const longLivedUserToken = longData.access_token || shortLivedToken;

      // Step C: Discover Facebook Pages and Instagram Business Account
      const accountsUrl = `https://graph.facebook.com/v19.0/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&access_token=${encodeURIComponent(longLivedUserToken)}`;
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
      const igId = tastPage.instagram_business_account?.id;
      const igUsername = tastPage.instagram_business_account?.username;

      // Save encrypted vault
      const vault: MetaTokenVault = {
        pageAccessToken,
        pageId,
        pageName,
        igId,
        igUsername,
        userAccessToken: longLivedUserToken,
        expiresAt: Date.now() + (60 * 24 * 60 * 60 * 1000), // 60 days
        updatedAt: new Date().toISOString()
      };

      await saveVault(vault);

      // Perform initial sync immediately
      try {
        await executeMetaSync(vault);
      } catch (syncErr) {
        console.warn("[api/social] Initial sync warning:", syncErr);
      }

      // Success HTML page that sends message to opener window
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.writeHead(200);
      res.end(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Connexió Meta Completada</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #09090b; color: #f4f4f5; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
            .card { background: #18181b; border: 1px solid #27272a; border-radius: 24px; padding: 32px; max-width: 400px; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }
            h2 { color: #10b981; margin-top: 0; }
            p { color: #a1a1aa; font-size: 14px; line-height: 1.5; }
            .btn { background: #ff0090; color: #fff; border: none; padding: 12px 24px; border-radius: 12px; font-weight: bold; cursor: pointer; text-decoration: none; display: inline-block; margin-top: 16px; }
          </style>
        </head>
        <body>
          <div class="card">
            <h2>✓ Connexió amb Meta correcta!</h2>
            <p>S'ha vinculat la pàgina <strong>${pageName}</strong> ${igUsername ? `i el compte d'Instagram <strong>@${igUsername}</strong>` : ''}.</p>
            <p>Ja pots tancar aquesta finestra i tornar al panell de control.</p>
            <button class="btn" onclick="finish()">Finalitzar i Tancar</button>
          </div>
          <script>
            function finish() {
              if (window.opener) {
                window.opener.postMessage({ type: 'META_AUTH_SUCCESS', pageName: '${pageName}', igUsername: '${igUsername || ''}' }, '*');
              }
              window.close();
            }
            setTimeout(finish, 2500);
          </script>
        </body>
        </html>
      `);
      return;
    } catch (err: any) {
      console.error("[api/social] Callback exception:", err);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.writeHead(500);
      res.end(`
        <!DOCTYPE html>
        <html>
        <head><title>Error en la connexió Meta</title></head>
        <body style="font-family:sans-serif; text-align:center; padding:40px; background:#121212; color:#fff;">
          <h2 style="color:#ef4444;">Error vinculant Meta</h2>
          <p style="color:#a1a1aa;">${err?.message || "Error desconegut"}</p>
          <button onclick="window.close()" style="background:#ff0090; color:#fff; border:none; padding:10px 20px; border-radius:8px; cursor:pointer; font-weight:bold;">Tancar</button>
        </body>
        </html>
      `);
      return;
    }
  }

  // ===========================================================
  // 3. STATUS (Admin & Public check)
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

    if (!vault || !vault.pageAccessToken) {
      return sendJson(200, {
        ok: true,
        configured: !!process.env.META_APP_ID,
        instagramConnected: false,
        facebookConnected: false,
        instagramHandle: "",
        facebookHandle: "",
        lastSync
      });
    }

    const isExpired = vault.expiresAt ? Date.now() > vault.expiresAt : false;

    return sendJson(200, {
      ok: true,
      configured: true,
      instagramConnected: !isExpired && !!vault.igId,
      facebookConnected: !isExpired && !!vault.pageId,
      instagramHandle: vault.igUsername ? `@${vault.igUsername}` : "@eltastvng",
      facebookHandle: vault.pageName || "El Tast Vilanova",
      expiresAt: vault.expiresAt,
      isExpired,
      lastSync
    });
  }

  // ===========================================================
  // 4. DISCONNECT (Admin only)
  // ===========================================================
  if (action === "disconnect") {
    const isAdmin = await verifyAdmin(req);
    if (!isAdmin) {
      return sendJson(403, { error: "Accés no autoritzat." });
    }

    await clearVault();

    return sendJson(200, {
      ok: true,
      message: "Connexió amb Meta desvinculada correctament."
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
    if (!vault || !vault.pageAccessToken) {
      return sendJson(400, {
        ok: false,
        error: "No hi ha cap compte de Meta connectat per sincronitzar."
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
        error: err?.message || "Error sincronitzant publicacions de Meta"
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
        if (vault && vault.pageAccessToken) {
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
  const token = vault.pageAccessToken;
  const newMetaPosts: any[] = [];

  // A. Fetch Instagram Media if Instagram Business Account is linked
  let instagramCount = 0;
  if (vault.igId) {
    try {
      const igUrl = `https://graph.facebook.com/v19.0/${encodeURIComponent(vault.igId)}/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count&limit=12&access_token=${encodeURIComponent(token)}`;
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
            usuari: vault.igUsername ? `@${vault.igUsername}` : "@eltastvng",
            text: caption || "Publicació a Instagram @eltastvng",
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
      console.warn("[api/social] Error fetching Instagram posts:", err);
    }
  }

  // B. Fetch Facebook Page Posts
  let facebookCount = 0;
  if (vault.pageId) {
    try {
      const fbUrl = `https://graph.facebook.com/v19.0/${encodeURIComponent(vault.pageId)}/posts?fields=id,message,created_time,permalink_url,full_picture&limit=12&access_token=${encodeURIComponent(token)}`;
      const fbRes = await fetch(fbUrl);
      const fbJson = await fbRes.json();

      if (fbJson && Array.isArray(fbJson.data)) {
        for (const item of fbJson.data) {
          if (!item.id || !item.message) continue;
          const message = (item.message || "").trim();

          newMetaPosts.push({
            id: `meta-fb-${item.id}`,
            xarxa: "facebook",
            usuari: vault.pageName || "Associació Cultural El Tast",
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
      }
    } catch (err) {
      console.warn("[api/social] Error fetching Facebook posts:", err);
    }
  }

  // C. Read current notices to strictly preserve manual notices
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

  // Combined notices list
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
