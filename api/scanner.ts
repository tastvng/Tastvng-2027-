import { applyCorsHeaders } from './_cors';

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

// Cleanup expired sessions every 2 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of activeSessions.entries()) {
    if (now > session.expiresAt + 60000) {
      activeSessions.delete(id);
    }
  }
}, 120000);

/**
 * Consolidated Mobile Scanner Serverless Handler: /api/scanner
 * Manages synchronous mobile QR pairing & real-time scanner exchange.
 */
export default async function scannerHandler(req: any, res: any) {
  if (res.setHeader) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
  }

  applyCorsHeaders(req, res, 'POST, GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status ? res.status(200).end() : res.sendStatus(200);
  }

  try {
    const payload = req.method === 'GET' ? req.query : (req.body || {});
    const { action, sessionId, syncKey, code } = payload;

    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({ error: 'sessionId és obligatori i ha de ser una cadena de text' });
    }

    const cleanSessionId = sessionId.trim().slice(0, 64);
    const cleanSyncKey = typeof syncKey === 'string' ? syncKey.trim().toUpperCase().slice(0, 16) : '';
    const now = Date.now();

    // 1. Action: create (Desktop PC initializes or renews session)
    if (action === 'create') {
      if (!cleanSyncKey) {
        return res.status(400).json({ error: 'syncKey és obligatòria' });
      }

      const session: EphemeralSession = {
        sessionId: cleanSessionId,
        syncKey: cleanSyncKey,
        createdAt: now,
        expiresAt: now + 20 * 60 * 1000, // 20 minutes
        status: 'esperando_conexion',
        lastPingPc: now,
        lastPingMobile: 0,
        lastScannedCode: null,
        scannedAt: null
      };

      activeSessions.set(cleanSessionId, session);

      return res.status(200).json({
        ok: true,
        session: {
          sessionId: session.sessionId,
          syncKey: session.syncKey,
          status: session.status,
          expiresAt: session.expiresAt
        }
      });
    }

    // Lookup existing session
    const session = activeSessions.get(cleanSessionId);

    if (!session) {
      return res.status(404).json({
        ok: false,
        error: 'Sessió no trobada o caducada. Si us plau, genera un nou QR des del PC.',
        status: 'sesion_caducada'
      });
    }

    // Check expiration
    if (now > session.expiresAt) {
      session.status = 'sesion_caducada';
      return res.status(410).json({
        ok: false,
        error: 'La sessió ha caducat.',
        status: 'sesion_caducada'
      });
    }

    // Verify syncKey if provided
    if (cleanSyncKey && session.syncKey !== cleanSyncKey) {
      return res.status(403).json({
        ok: false,
        error: 'Clau de sincronització no vàlida.'
      });
    }

    // 2. Action: mobile_connect (Smartphone joins session)
    if (action === 'mobile_connect') {
      session.lastPingMobile = now;
      session.status = 'movil_conectado';

      return res.status(200).json({
        ok: true,
        status: 'movil_conectado',
        message: 'Mòbil connectat amb èxit a la sessió.'
      });
    }

    // 3. Action: pc_poll (Desktop checks session state and receives scans)
    if (action === 'pc_poll' || (req.method === 'GET' && action === 'poll')) {
      session.lastPingPc = now;

      // If mobile hasn't pinged in 45s and was connected, mark as disconnected
      if (session.status !== 'esperando_conexion' && session.lastPingMobile > 0 && now - session.lastPingMobile > 45000) {
        session.status = 'movil_desconectado';
      }

      if (session.status === 'codigo_recibido' && session.lastScannedCode) {
        const receivedCode = session.lastScannedCode;
        // Reset immediately to waiting for next scan to avoid repeat triggers
        session.status = 'esperando_escaneo';
        session.lastScannedCode = null;

        return res.status(200).json({
          ok: true,
          status: 'codigo_recibido',
          code: receivedCode,
          expiresAt: session.expiresAt
        });
      }

      return res.status(200).json({
        ok: true,
        status: session.status,
        expiresAt: session.expiresAt
      });
    }

    // 4. Action: mobile_scan (Smartphone sends scanned QR code)
    if (action === 'mobile_scan') {
      if (!code || typeof code !== 'string') {
        return res.status(400).json({ error: 'Codi escanejat no vàlid' });
      }

      const cleanCode = code.trim().slice(0, 100);

      session.lastPingMobile = now;
      session.lastScannedCode = cleanCode;
      session.scannedAt = now;
      session.status = 'codigo_recibido';

      return res.status(200).json({
        ok: true,
        message: 'Codi enviat correctament a l’ordinador.'
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
      return res.status(200).json({
        ok: true,
        status: session.status
      });
    }

    // 6. Action: disconnect or mobile_disconnect
    if (action === 'disconnect' || action === 'mobile_disconnect') {
      session.status = 'movil_desconectado';
      return res.status(200).json({ ok: true, status: 'movil_desconectado' });
    }

    // 7. Action: status
    if (action === 'status') {
      return res.status(200).json({
        ok: true,
        status: session.status,
        expiresAt: session.expiresAt
      });
    }

    return res.status(400).json({ error: `Acció desconeguda a /api/scanner: ${action}` });
  } catch (err: any) {
    console.error('Error in /api/scanner handler:', err);
    return res.status(500).json({ error: 'Error intern al servei d’escàner' });
  }
}
