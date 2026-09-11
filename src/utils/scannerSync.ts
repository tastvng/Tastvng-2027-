/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { RemoteScannerSession, RemoteScannerStatus } from '../types';

export interface SafeJsonResponse<T = any> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
  code?: string;
  rawText?: string;
  endpointUrl: string;
}

/**
 * Universal safe JSON fetcher:
 * 1. Checks Content-Type header before parsing.
 * 2. If non-JSON (e.g. text/html, 500 error pages), reads response.text() safely.
 * 3. Never throws Unexpected token 'A' / syntax errors.
 * 4. Captures and exposes exact endpointUrl and technical diagnostics.
 */
export async function safeFetchJson<T = any>(
  endpointUrl: string,
  options: RequestInit
): Promise<SafeJsonResponse<T>> {
  try {
    const res = await fetch(endpointUrl, options);
    const contentType = (res.headers.get('content-type') || '').toLowerCase();

    // Check if Content-Type contains application/json
    if (!contentType.includes('application/json')) {
      const rawText = await res.text();
      const preview = rawText.length > 200 ? rawText.slice(0, 200) + '...' : rawText;
      console.warn(`[SYNC HTTP WARN] Endpoint ${endpointUrl} returned non-JSON (${contentType}): ${preview}`);
      return {
        ok: false,
        status: res.status,
        error: `Endpoint ${endpointUrl} ha retornat text/HTML (${res.status}): ${preview}`,
        code: 'NON_JSON_RESPONSE',
        rawText,
        endpointUrl
      };
    }

    try {
      const data = await res.json();
      return {
        ok: res.ok && data?.ok !== false,
        status: res.status,
        data,
        error: data?.error,
        code: data?.code,
        endpointUrl
      };
    } catch (parseErr: any) {
      console.error(`[SYNC JSON PARSE ERROR] Failed to parse JSON from ${endpointUrl}:`, parseErr);
      return {
        ok: false,
        status: res.status,
        error: `Error de format JSON a ${endpointUrl}: ${parseErr.message}`,
        code: 'JSON_PARSE_ERROR',
        endpointUrl
      };
    }
  } catch (networkErr: any) {
    console.error(`[SYNC NETWORK ERROR] Network error contacting ${endpointUrl}:`, networkErr);
    return {
      ok: false,
      status: 0,
      error: `Error de xarxa en connectar amb ${endpointUrl}: ${networkErr.message}`,
      code: 'NETWORK_ERROR',
      endpointUrl
    };
  }
}

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

  // Never use localhost or private IP in the QR code
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname.startsWith('192.168.') ||
    hostname.startsWith('10.')
  ) {
    // Canonical public URL
    return 'https://tastvng-2027.vercel.app';
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
  const res = await safeFetchJson<any>('/api/scanner', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'create',
      sessionId,
      syncKey
    })
  });

  if (!res.ok || !res.data) {
    console.warn('[SCANNER PC] Failed to create session via /api/scanner:', res.error);
    return null;
  }

  console.log('[SCANNER PC] session created', {
    sessionId: res.data.sessionId || sessionId,
    syncKey: res.data.syncKey || syncKey,
    status: res.data.status
  });

  return {
    sessionId: res.data.sessionId || sessionId,
    syncKey: res.data.syncKey || syncKey,
    createdAt: Date.now(),
    expiresAt: res.data.expiresAt || (Date.now() + 30 * 60 * 1000),
    status: res.data.status || 'esperando_conexion',
    lastPingPc: Date.now(),
    lastPingMobile: 0,
    lastScannedCode: null
  };
}

/**
 * Desktop PC polls the ephemeral session for status updates and unconsumed scanned codes.
 * If renewModal is true, server automatically extends the 30-min TTL.
 */
export async function apiPollSession(
  sessionId: string, 
  syncKey: string,
  renewModal: boolean = false
): Promise<{ ok: boolean; status: RemoteScannerStatus; code?: string; expiresAt?: number; error?: string }> {
  const res = await safeFetchJson<any>('/api/scanner', {
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
      return { ok: false, status: 'sesion_caducada', error: res.error };
    }
    return { ok: false, status: 'esperando_conexion', error: res.error };
  }

  const data = res.data || {};
  return {
    ok: true,
    status: data.status || 'esperando_conexion',
    code: data.code,
    expiresAt: data.expiresAt
  };
}

/**
 * Explicitly renews session TTL (e.g. while modal is open)
 */
export async function apiRenewSession(sessionId: string, syncKey: string): Promise<{ ok: boolean; expiresAt?: number }> {
  const res = await safeFetchJson<any>('/api/scanner', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'renew',
      sessionId,
      syncKey
    })
  });

  if (!res.ok || !res.data) return { ok: false };
  return { ok: true, expiresAt: res.data.expiresAt };
}

/**
 * Explicitly invalidates session on close or regenerate
 */
export async function apiInvalidateSession(sessionId: string, syncKey: string): Promise<boolean> {
  const res = await safeFetchJson<any>('/api/scanner', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'invalidate',
      sessionId,
      syncKey
    })
  });
  return res.ok;
}
