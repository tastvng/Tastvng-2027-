/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Persistent translation cache to prevent code 429 quota exhaustion on Gemini API
const LOCAL_STORAGE_CACHE_KEY = 'tast_translations_cache_v2';

let translationCache: Record<string, string> = {};
try {
  if (typeof localStorage !== 'undefined') {
    const cached = localStorage.getItem(LOCAL_STORAGE_CACHE_KEY);
    if (cached) {
      translationCache = JSON.parse(cached);
    }
  }
} catch (e) {
  console.warn("Could not load translation cache from localStorage:", e);
}

function saveCache() {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_CACHE_KEY, JSON.stringify(translationCache));
    }
  } catch (e) {
    console.warn("Could not save translation cache to localStorage:", e);
  }
}

export async function translateText(
  text: string, 
  source: 'ca' | 'es' | 'auto', 
  target: 'ca' | 'es'
): Promise<string> {
  if (!text || !text.trim()) return text;
  if (source !== 'auto' && source === target) return text;
  
  // If we already detected quota exceeded in this session, return text directly
  if (typeof window !== 'undefined' && window.sessionStorage?.getItem('tast_translation_quota_exceeded') === 'true') {
    return text;
  }

  // If the text is standard numbers, punctuation, or very short, bypass translation
  const clean = text.trim();
  if (/^[0-9\s\-\+\.\,€\/]+$/.test(clean)) {
    return clean;
  }

  const cacheKey = `${clean}_${source}_${target}`;
  if (translationCache[cacheKey]) {
    return translationCache[cacheKey];
  }
  
  try {
    const response = await fetch('/api/translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: clean,
        source,
        target,
      }),
    });
    
    if (response.status === 429) {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.setItem('tast_translation_quota_exceeded', 'true');
        window.dispatchEvent(new Event('translationQuotaExceeded'));
      }
      return text;
    }

    if (response.ok) {
      const data = await response.json();
      const result = data.translatedText || clean;
      
      // Save to in-memory and persistent storage
      translationCache[cacheKey] = result;
      saveCache();
      return result;
    } else {
      const data = await response.json().catch(() => ({}));
      if (data.error === "quota_exceeded") {
        if (typeof window !== 'undefined' && window.sessionStorage) {
          window.sessionStorage.setItem('tast_translation_quota_exceeded', 'true');
          window.dispatchEvent(new Event('translationQuotaExceeded'));
        }
      }
    }
  } catch (error) {
    console.warn("Translation service call failed gracefully:", error);
  }
  
  // Fallback to original text on any failure
  return text;
}

export async function syncDetectAndTranslate(
  text: string,
  onUpdateCa: (val: string) => void,
  onUpdateEs: (val: string) => void,
  setLoadingState?: (loading: boolean) => void
) {
  if (!text || !text.trim()) return;
  if (setLoadingState) setLoadingState(true);
  try {
    const [translatedCa, translatedEs] = await Promise.all([
      translateText(text, 'auto', 'ca'),
      translateText(text, 'auto', 'es')
    ]);
    if (translatedCa && translatedCa.trim()) {
      onUpdateCa(translatedCa.trim());
    }
    if (translatedEs && translatedEs.trim()) {
      onUpdateEs(translatedEs.trim());
    }
  } catch (err) {
    console.error("Error in syncDetectAndTranslate:", err);
  } finally {
    if (setLoadingState) setLoadingState(false);
  }
}

