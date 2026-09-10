/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

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

export default async function handler(req: any, res: any) {
  applyCorsHeaders(req, res, 'POST, GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { action, sessionId, syncKey, code } = req.body || {};

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

      const expiresAt = now + 20 * 60 * 1000; // 20 minuts de validesa
      const session: EphemeralSession = {
        sessionId: cleanSessionId,
        syncKey: cleanSyncKey,
        createdAt: now,
        expiresAt,
        status: 'esperando_conexion',
        lastPingPc: now,
        lastPingMobile: 0,
        lastScannedCode: null,
        scannedAt: null,
      };

      activeSessions.set(cleanSessionId, session);
      return res.status(200).json({
        ok: true,
        session: {
          sessionId: cleanSessionId,
          syncKey: cleanSyncKey,
          status: 'esperando_conexion',
          expiresAt
        }
      });
    }

    // Retrieve existing session
    const session = activeSessions.get(cleanSessionId);
    if (!session) {
      return res.status(404).json({
        ok: false,
        status: 'sesion_caducada',
        error: 'Sessió no trobada o caducada. Torneu a enllaçar el dispositiu.'
      });
    }

    // Check expiration
    if (now > session.expiresAt) {
      session.status = 'sesion_caducada';
      return res.status(200).json({
        ok: false,
        status: 'sesion_caducada',
        error: 'Aquesta sessió ha caducat.'
      });
    }

    // Validate syncKey match
    if (cleanSyncKey && session.syncKey !== cleanSyncKey) {
      return res.status(403).json({
        ok: false,
        error: 'Clau de sincronització (syncKey) incorrecta.'
      });
    }

    // 2. Action: mobile_connect (Mobile phone reports successful connection)
    if (action === 'mobile_connect') {
      session.status = 'movil_conectado';
      session.lastPingMobile = now;
      return res.status(200).json({
        ok: true,
        status: 'movil_conectado',
        message: 'Mòbil connectat amb èxit a la sessió.'
      });
    }

    // 3. Action: mobile_ping (Mobile heartbeat)
    if (action === 'mobile_ping') {
      session.lastPingMobile = now;
      if (session.status === 'movil_desconectado') {
        session.status = 'movil_conectado';
      }
      return res.status(200).json({ ok: true, status: session.status });
    }

    // 4. Action: mobile_scan (Mobile transmits scanned QR code to PC)
    if (action === 'mobile_scan') {
      if (!code || typeof code !== 'string') {
        return res.status(400).json({ error: 'Codi escanejat no vàlid' });
      }

      const cleanCode = code.trim().slice(0, 256);
      if (!cleanCode) {
        return res.status(400).json({ error: 'Codi buit' });
      }

      session.lastScannedCode = cleanCode;
      session.scannedAt = now;
      session.status = 'codigo_recibido';
      session.lastPingMobile = now;

      return res.status(200).json({
        ok: true,
        message: 'Codi enviat correctament a l’ordinador.'
      });
    }

    // 5. Action: pc_poll (Desktop PC queries session status and consumes any scanned code)
    if (action === 'pc_poll') {
      session.lastPingPc = now;

      // Check if mobile has been silent for > 45 seconds while it was connected
      if (
        (session.status === 'movil_conectado' || session.status === 'esperando_escaneo') &&
        session.lastPingMobile > 0 &&
        now - session.lastPingMobile > 45000
      ) {
        session.status = 'movil_desconectado';
      }

      // If there is an unconsumed scanned code
      if (session.lastScannedCode) {
        const deliveredCode = session.lastScannedCode;
        // WIPE code immediately from server memory so it is NEVER permanently retained!
        session.lastScannedCode = null;
        session.status = 'esperando_escaneo';

        return res.status(200).json({
          ok: true,
          status: 'codigo_recibido',
          code: deliveredCode,
          expiresAt: session.expiresAt
        });
      }

      return res.status(200).json({
        ok: true,
        status: session.status,
        expiresAt: session.expiresAt
      });
    }

    // 6. Action: disconnect or mobile_disconnect
    if (action === 'disconnect' || action === 'mobile_disconnect') {
      session.status = 'movil_desconectado';
      return res.status(200).json({ ok: true, status: 'movil_desconectado' });
    }

    return res.status(400).json({ error: `Acció desconeguda: ${action}` });
  } catch (err: any) {
    console.error('Error handling scanner session:', err);
    return res.status(500).json({ error: 'Error intern del servidor al processar la sessió' });
  }
}
