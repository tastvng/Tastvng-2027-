/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Consolidated Mobile Scanner Serverless Handler: /api/scanner
 * Fully compliant with Vercel Serverless Functions and Express dev server.
 * Always returns JSON with Content-Type: application/json; charset=utf-8.
 */

export interface EphemeralSession {
  sessionId: string;
  syncKey: string;
  createdAt: number;
  expiresAt: number;
  status: 'esperando_conexion' | 'movil_conectado' | 'esperando_escaneo' | 'codigo_recibido' | 'sesion_caducada' | 'movil_desconectado';
  lastPingPc: number;
  lastPingMobile: number;
  lastScannedCode: string | null;
  scannedAt: number | null;
}

// In-memory sessions store (ephemeral, temporary, auto-expiring)
const activeSessions = new Map<string, EphemeralSession>();

// Minimum session duration: 30 minutes
const MIN_SESSION_DURATION_MS = 30 * 60 * 1000;

/**
 * Self-contained CORS helper to prevent module resolution failures in Vercel ESM
 */
function applyCors(req: any, res: any) {
  const origin = req?.headers?.origin || '*';
  if (res && typeof res.setHeader === 'function') {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('X-Content-Type-Options', 'nosniff');
  }
}

/**
 * Ultra-safe JSON responder compatible with both Vercel (@vercel/node),
 * Express, and native Node.js http.ServerResponse.
 * NEVER returns plain text or HTML.
 */
function sendJson(res: any, statusCode: number, data: any) {
  const jsonString = JSON.stringify(data);

  if (res && typeof res.setHeader === 'function') {
    try {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('X-Content-Type-Options', 'nosniff');
    } catch (e) {}
  }

  // 1. Express / Vercel style: res.status(code).json(data)
  if (res && typeof res.status === 'function' && typeof res.json === 'function') {
    return res.status(statusCode).json(data);
  }

  // 2. Node.js native: res.writeHead(code, headers).end(string)
  if (res && typeof res.writeHead === 'function' && typeof res.end === 'function') {
    try {
      res.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'X-Content-Type-Options': 'nosniff'
      });
      return res.end(jsonString);
    } catch (e) {}
  }

  // 3. Fallback
  if (res) {
    res.statusCode = statusCode;
    if (typeof res.end === 'function') {
      return res.end(jsonString);
    }
  }

  return jsonString;
}

/**
 * Consolidated Mobile Scanner Serverless Handler: /api/scanner
 */
export default async function scannerHandler(req: any, res: any) {
  applyCors(req, res);

  if (req?.method === 'OPTIONS') {
    if (typeof res.status === 'function') return res.status(200).end();
    if (typeof res.sendStatus === 'function') return res.sendStatus(200);
    if (typeof res.end === 'function') return res.end();
    return;
  }

  try {
    // Lazy cleanup of genuinely expired sessions without top-level timers
    if (activeSessions.size > 20) {
      const nowTs = Date.now();
      for (const [id, s] of activeSessions.entries()) {
        if (nowTs > s.expiresAt + 60000) {
          activeSessions.delete(id);
        }
      }
    }

    // Safely parse request payload across GET query, parsed body, string body, or buffer
    let payload: any = {};
    if (req.method === 'GET') {
      payload = req.query || {};
    } else {
      if (typeof req.body === 'object' && req.body !== null && !Buffer.isBuffer(req.body)) {
        payload = req.body;
      } else if (typeof req.body === 'string') {
        try {
          payload = JSON.parse(req.body);
        } catch (e) {
          payload = {};
        }
      } else if (Buffer.isBuffer(req.body)) {
        try {
          payload = JSON.parse(req.body.toString('utf-8'));
        } catch (e) {
          payload = {};
        }
      } else if (req.query && Object.keys(req.query).length > 0) {
        payload = req.query;
      }
    }

    const { action, sessionId, syncKey, code, renewModal } = payload || {};

    if (!sessionId || typeof sessionId !== 'string') {
      return sendJson(res, 400, {
        ok: false,
        error: 'sessionId és obligatori i ha de ser una cadena de text',
        code: 'INVALID_PARAMS'
      });
    }

    const cleanSessionId = sessionId.trim().slice(0, 64);
    const cleanSyncKey = typeof syncKey === 'string' ? syncKey.trim().toUpperCase().slice(0, 16) : '';
    const now = Date.now();

    // 1. Action: create (Desktop PC initializes or renews session)
    if (action === 'create') {
      if (!cleanSyncKey) {
        return sendJson(res, 400, {
          ok: false,
          error: 'syncKey és obligatòria',
          code: 'INVALID_PARAMS'
        });
      }

      const session: EphemeralSession = {
        sessionId: cleanSessionId,
        syncKey: cleanSyncKey,
        createdAt: now,
        expiresAt: now + MIN_SESSION_DURATION_MS,
        status: 'esperando_conexion',
        lastPingPc: now,
        lastPingMobile: 0,
        lastScannedCode: null,
        scannedAt: null
      };

      activeSessions.set(cleanSessionId, session);

      return sendJson(res, 200, {
        ok: true,
        connected: false,
        sessionId: cleanSessionId,
        syncKey: cleanSyncKey,
        status: 'esperando_conexion',
        expiresAt: session.expiresAt
      });
    }

    // Lookup existing session
    let session = activeSessions.get(cleanSessionId);

    // If session not found in memory (e.g. stateless Vercel invocation across lambdas):
    // Auto-recover/hydrate session if cleanSessionId and cleanSyncKey are present
    if (!session) {
      if (cleanSyncKey && (action === 'mobile_connect' || action === 'pc_poll' || action === 'renew' || action === 'ping')) {
        session = {
          sessionId: cleanSessionId,
          syncKey: cleanSyncKey,
          createdAt: now,
          expiresAt: now + MIN_SESSION_DURATION_MS,
          status: action === 'mobile_connect' ? 'movil_conectado' : 'esperando_conexion',
          lastPingPc: now,
          lastPingMobile: action === 'mobile_connect' ? now : 0,
          lastScannedCode: null,
          scannedAt: null
        };
        activeSessions.set(cleanSessionId, session);
      } else {
        return sendJson(res, 404, {
          ok: false,
          error: 'Sessió no trobada o caducada. Si us plau, genera un nou QR des del PC.',
          code: 'SESSION_NOT_FOUND',
          status: 'sesion_caducada'
        });
      }
    }

    // Explicit destruction/invalidation
    if (action === 'destroy' || action === 'invalidate') {
      activeSessions.delete(cleanSessionId);
      return sendJson(res, 200, {
        ok: true,
        connected: false,
        sessionId: cleanSessionId,
        syncKey: cleanSyncKey,
        message: 'Sessió invalidada correctament.',
        status: 'sesion_caducada'
      });
    }

    // Verify syncKey if provided
    if (cleanSyncKey && session.syncKey && session.syncKey !== cleanSyncKey) {
      return sendJson(res, 403, {
        ok: false,
        error: 'Clau de sincronització no vàlida.',
        code: 'INVALID_SYNC_KEY'
      });
    }

    // Renew TTL if requested (e.g. while pairing modal is open)
    if (action === 'renew' || renewModal === true || renewModal === 'true') {
      session.expiresAt = Math.max(session.expiresAt, now + MIN_SESSION_DURATION_MS);
    }

    // Check expiration
    if (now > session.expiresAt) {
      session.status = 'sesion_caducada';
      return sendJson(res, 410, {
        ok: false,
        error: 'La sessió ha caducat.',
        code: 'SESSION_EXPIRED',
        status: 'sesion_caducada'
      });
    }

    // 2. Action: mobile_connect (Smartphone registers connection)
    if (action === 'mobile_connect') {
      session.lastPingMobile = now;
      session.status = 'movil_conectado';

      return sendJson(res, 200, {
        ok: true,
        connected: true,
        sessionId: cleanSessionId,
        syncKey: session.syncKey || cleanSyncKey,
        status: 'movil_conectado',
        message: 'Mòbil connectat amb èxit a la sessió.',
        expiresAt: session.expiresAt
      });
    }

    // 3. Action: pc_poll (Desktop checks session state and receives scans)
    if (action === 'pc_poll' || (req.method === 'GET' && action === 'poll')) {
      session.lastPingPc = now;

      // Check mobile timeout
      if (session.status !== 'esperando_conexion' && session.lastPingMobile > 0 && now - session.lastPingMobile > 45000) {
        session.status = 'movil_desconectado';
      }

      if (session.status === 'codigo_recibido' && session.lastScannedCode) {
        const receivedCode = session.lastScannedCode;
        session.status = 'esperando_escaneo';
        session.lastScannedCode = null;

        return sendJson(res, 200, {
          ok: true,
          connected: true,
          sessionId: cleanSessionId,
          syncKey: session.syncKey,
          status: 'codigo_recibido',
          code: receivedCode,
          expiresAt: session.expiresAt
        });
      }

      return sendJson(res, 200, {
        ok: true,
        connected: session.status === 'movil_conectado' || session.status === 'esperando_escaneo',
        sessionId: cleanSessionId,
        syncKey: session.syncKey,
        status: session.status,
        expiresAt: session.expiresAt
      });
    }

    // 4. Action: mobile_scan (Smartphone sends scanned QR code)
    if (action === 'mobile_scan') {
      if (!code || typeof code !== 'string') {
        return sendJson(res, 400, {
          ok: false,
          error: 'Codi escanejat no vàlid',
          code: 'INVALID_PARAMS'
        });
      }

      const cleanCode = code.trim().slice(0, 100);
      session.lastPingMobile = now;
      session.lastScannedCode = cleanCode;
      session.scannedAt = now;
      session.status = 'codigo_recibido';

      return sendJson(res, 200, {
        ok: true,
        connected: true,
        sessionId: cleanSessionId,
        syncKey: session.syncKey,
        status: 'codigo_recibido',
        code: cleanCode,
        message: 'Codi enviat correctament a l’ordinador.',
        expiresAt: session.expiresAt
      });
    }

    // 5. Action: ping (keepalive from mobile or pc)
    if (action === 'ping') {
      const from = payload.from;
      if (from === 'mobile') {
        session.lastPingMobile = now;
      } else {
        session.lastPingPc = now;
      }
      return sendJson(res, 200, {
        ok: true,
        connected: session.status === 'movil_conectado' || session.status === 'esperando_escaneo',
        sessionId: cleanSessionId,
        syncKey: session.syncKey,
        status: session.status,
        expiresAt: session.expiresAt
      });
    }

    // 6. Action: disconnect or mobile_disconnect
    if (action === 'disconnect' || action === 'mobile_disconnect') {
      session.status = 'movil_desconectado';
      return sendJson(res, 200, {
        ok: true,
        connected: false,
        sessionId: cleanSessionId,
        syncKey: session.syncKey,
        status: 'movil_desconectado',
        expiresAt: session.expiresAt
      });
    }

    // 7. Action: status
    if (action === 'status') {
      return sendJson(res, 200, {
        ok: true,
        connected: session.status === 'movil_conectado' || session.status === 'esperando_escaneo',
        sessionId: cleanSessionId,
        syncKey: session.syncKey,
        status: session.status,
        expiresAt: session.expiresAt
      });
    }

    return sendJson(res, 400, {
      ok: false,
      error: `Acció desconeguda a /api/scanner: ${action}`,
      code: 'INVALID_ACTION'
    });
  } catch (err: any) {
    console.error('Error in /api/scanner handler:', err);
    return sendJson(res, 500, {
      ok: false,
      error: err?.message || 'Error intern al servei d’escàner',
      code: 'SYNC_ERROR'
    });
  }
}
