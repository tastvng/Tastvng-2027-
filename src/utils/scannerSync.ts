/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { RemoteScannerSession, RemoteScannerStatus } from '../types';

/**
 * Returns a public HTTPS URL origin for the mobile scanner QR code.
 * Strictly guarantees that localhost or 127.0.0.1 are NEVER exposed in the QR link,
 * falling back to the canonical public deployment URL if running locally.
 */
export function getPublicScannerOrigin(): string {
  if (typeof window === 'undefined') {
    return 'https://tastvng-2027.vercel.app';
  }

  const hostname = window.location.hostname;
  const protocol = window.location.protocol;

  // Never use localhost or private IP in the QR code
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname.startsWith('192.168.') ||
    hostname.startsWith('10.')
  ) {
    // If running in Cloud Run preview container or Vercel
    const publicAppUrl = 'https://ais-pre-fjlsnihvgnxuh2wpg3ndif-80876558973.europe-west2.run.app';
    return publicAppUrl;
  }

  // Ensure HTTPS
  const cleanOrigin = window.location.origin;
  if (cleanOrigin.startsWith('http://')) {
    return cleanOrigin.replace('http://', 'https://');
  }

  return cleanOrigin;
}

/**
 * Constructs the pairing URL for the remote mobile scanner
 */
export function buildMobilePairingUrl(syncKey: string, sessionId: string): string {
  const origin = getPublicScannerOrigin();
  const path = typeof window !== 'undefined' ? window.location.pathname : '/';
  return `${origin}${path}?mode=mobile-scanner&syncKey=${encodeURIComponent(syncKey)}&sessionId=${encodeURIComponent(sessionId)}`;
}

/**
 * Validates and extracts the clean tracking code or ID from raw scanned QR payload.
 */
export function extractAndValidateCode(raw: string): string | null {
  if (!raw || typeof raw !== 'string') return null;
  let code = raw.trim();

  // If the scanned code is an URL, extract parameter
  if (code.includes('://') || code.includes('?')) {
    try {
      const urlObj = new URL(code);
      const paramCode = urlObj.searchParams.get('codi') || 
                        urlObj.searchParams.get('code') || 
                        urlObj.searchParams.get('id');
      if (paramCode) {
        code = paramCode.trim();
      } else {
        const segments = urlObj.pathname.split('/').filter(Boolean);
        if (segments.length > 0) {
          code = segments[segments.length - 1].trim();
        }
      }
    } catch (e) {
      // url parse error, continue with clean code
    }
  }

  // Sanitize: strip script tags or suspicious control characters
  code = code.replace(/[<>"'`]/g, '').trim();

  if (code.length < 2 || code.length > 128) {
    return null;
  }

  return code;
}

/**
 * Desktop PC creates or renews an ephemeral session on the serverless API.
 */
export async function apiCreateSession(sessionId: string, syncKey: string): Promise<RemoteScannerSession | null> {
  try {
    const res = await fetch('/api/scanner', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create',
        sessionId,
        syncKey
      })
    });

    if (!res.ok) return null;
    const data = await res.json();
    return data.session || null;
  } catch (err) {
    console.warn('Error creating scanner session via API:', err);
    return null;
  }
}

/**
 * Desktop PC polls the ephemeral session for status updates and unconsumed scanned codes.
 * If renewModal is true, server automatically extends the 30-min TTL.
 */
export async function apiPollSession(
  sessionId: string, 
  syncKey: string,
  renewModal: boolean = false
): Promise<{ ok: boolean; status: RemoteScannerStatus; code?: string; expiresAt?: number }> {
  try {
    const res = await fetch('/api/scanner', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'pc_poll',
        sessionId,
        syncKey,
        renewModal
      })
    });

    if (!res.ok) {
      if (res.status === 410) {
        return { ok: false, status: 'sesion_caducada' };
      }
      return { ok: false, status: 'esperando_conexion' };
    }

    const data = await res.json();
    return {
      ok: !!data.ok,
      status: data.status || 'esperando_conexion',
      code: data.code,
      expiresAt: data.expiresAt
    };
  } catch (err) {
    return { ok: false, status: 'esperando_conexion' };
  }
}

/**
 * Explicitly renews session TTL (e.g. while modal is open)
 */
export async function apiRenewSession(sessionId: string, syncKey: string): Promise<{ ok: boolean; expiresAt?: number }> {
  try {
    const res = await fetch('/api/scanner', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'renew',
        sessionId,
        syncKey
      })
    });
    if (!res.ok) return { ok: false };
    const data = await res.json();
    return { ok: true, expiresAt: data.expiresAt };
  } catch (e) {
    return { ok: false };
  }
}

/**
 * Explicitly invalidates session on close or regenerate
 */
export async function apiInvalidateSession(sessionId: string, syncKey: string): Promise<boolean> {
  try {
    const res = await fetch('/api/scanner', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'invalidate',
        sessionId,
        syncKey
      })
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}
