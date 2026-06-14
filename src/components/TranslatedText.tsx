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

  useEffect(() => {
    if (!text || !text.trim()) {
      setDisplayedText('');
      return;
    }

    let isMounted = true;
    
    async function performTranslation() {
      setLoading(true);
      try {
        const translated = await translateText(text, 'auto', language);
        if (isMounted) {
          setDisplayedText(translated);
        }
      } catch (err) {
        console.error("Failed to translate:", err);
        if (isMounted) {
          setDisplayedText(text); // Fallback to original
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
      className={`${className} transition-opacity duration-200 ${loading ? 'opacity-70' : 'opacity-100'}`}
    >
      {displayedText}
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

