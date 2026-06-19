import React, { useState, useEffect } from 'react';
import { useLanguage } from '../LanguageContext';
import { translateText } from '../translateService';

interface TranslatedTextProps {
  text: string;
  className?: string;
  as?: 'span' | 'p' | 'div' | 'h3' | 'h4' | 'h5' | 'h6' | 'li';
}

export default function TranslatedText({ 
  text, 
  className = '', 
  as = 'span' 
}: TranslatedTextProps) {
  const { language } = useLanguage();
  const [displayedText, setDisplayedText] = useState(text);
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!text || !text.trim()) {
      setDisplayedText('');
      setVisible(false);
      return;
    }

    let isMounted = true;
    
    async function performTranslation() {
      // Step 1: Trigger transition and fade out
      setVisible(false);
      setLoading(true);
      
      // Give a tiny moment for fade-out transition to take visual effect
      await new Promise(resolve => setTimeout(resolve, 150));
      
      try {
        const translated = await translateText(text, 'auto', language);
        if (isMounted) {
          setDisplayedText(translated);
          setVisible(true);
        }
      } catch (err) {
        console.error("Failed to translate:", err);
        if (isMounted) {
          setDisplayedText(text); // Fallback to original
          setVisible(true);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    performTranslation();

    return () => {
      isMounted = false;
    };
  }, [text, language]);

  const Component = as;

  return (
    <Component 
      className={`${className} transition-all duration-300 ease-out ${
        visible 
          ? 'opacity-100 translate-y-0 filter-none' 
          : 'opacity-0 -translate-y-1 blur-[3px]'
      } ${loading ? 'text-zinc-400 select-none' : ''}`}
    >
      {displayedText || text}
    </Component>
  );
}

// React custom hook to translate a raw text string reactively
export function useTranslatedText(text: string): string {
  const { language } = useLanguage();
  const [translated, setTranslated] = useState(text);

  useEffect(() => {
    if (!text || !text.trim()) {
      setTranslated('');
      return;
    }
    let isMounted = true;
    async function doTranslation() {
      try {
        const res = await translateText(text, 'auto', language);
        if (isMounted) {
          setTranslated(res);
        }
      } catch (e) {
        if (isMounted) setTranslated(text);
      }
    }
    doTranslation();
    return () => {
      isMounted = false;
    };
  }, [text, language]);

  return translated;
}

// Option element helper to dynamically translate options in drop-down selects
export function TranslatedOption({ value, ...props }: { value: string } & React.OptionHTMLAttributes<HTMLOptionElement>) {
  const translated = useTranslatedText(value);
  return (
    <option value={value} {...props}>
      {translated}
    </option>
  );
}

