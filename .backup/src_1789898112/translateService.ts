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
  
  // If the text is standard numbers, punctuation, or very short, bypass translation
  const clean = text.trim();
  if (/^[0-9\s\-\+\.\,€\/]+$/.test(clean)) {
    return clean;
  }

  // Determine source language if it's 'auto'
  let srcLang: 'ca' | 'es' = 'ca';
  if (source === 'auto') {
    const lowercaseText = clean.toLowerCase();
    // Simple heuristic to detect Catalan vs Spanish based on common stopwords
    const isCatalan = /\b(i|amb|els|les|per|del|dels|pel|pels|aquesta|aquest|preguntes|formulari|tast|inscripció|inscripcions|condicions|si us plau)\b/i.test(lowercaseText) || 
                      lowercaseText.includes(" l'") || 
                      lowercaseText.includes(" d'") ||
                      lowercaseText.includes(" m'") ||
                      lowercaseText.includes(" s'") ||
                      lowercaseText.includes(" t'");
                      
    const isSpanish = /\b(y|con|los|las|por|del|este|esta|preguntas|formulario|inscripción|inscripciones|condiciones|por favor)\b/i.test(lowercaseText);

    if (isCatalan && !isSpanish) {
      srcLang = 'ca';
    } else if (isSpanish && !isCatalan) {
      srcLang = 'es';
    } else {
      srcLang = target === 'ca' ? 'es' : 'ca';
    }
  } else {
    srcLang = source;
  }

  if (srcLang === target) return clean;

  const cacheKey = `${clean}_${srcLang}_${target}`;
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
        q: clean,
        text: clean,
        source: srcLang,
        source_language: srcLang,
        target: target,
        target_language: target,
        format: 'text'
      }),
    });
    
    if (response.ok) {
      const data = await response.json();
      const result = data.translatedText || clean;
      
      // Save to in-memory and persistent storage
      translationCache[cacheKey] = result;
      saveCache();
      return result;
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

