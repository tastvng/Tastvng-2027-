/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export async function translateText(text: string, source: 'ca' | 'es', target: 'ca' | 'es'): Promise<string> {
  if (!text || !text.trim() || source === target) return text;
  
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
      return data.translatedText || text;
    }
  } catch (error) {
    console.error("Error in translation service call:", error);
  }
  
  return text;
}
