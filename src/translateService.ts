/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const translationCache: Record<string, string> = {};

export async function translateText(
  text: string, 
  source: 'ca' | 'es' | 'auto', 
  target: 'ca' | 'es'
): Promise<string> {
  if (!text || !text.trim()) return text;
  if (source !== 'auto' && source === target) return text;
  
  const cacheKey = `${text.trim()}_${source}_${target}`;
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
        text,
        source,
        target,
      }),
    });
    
    if (response.ok) {
      const data = await response.json();
      const result = data.translatedText || text;
      translationCache[cacheKey] = result;
      return result;
    }
  } catch (error) {
    console.error("Error in translation service call:", error);
  }
  
  return text;
}
