import { useState, useEffect } from 'react';

export function useActiveYear(): string {
  const [year, setYear] = useState(() => {
    try {
      return localStorage.getItem('tast_any_edicio') || '2027';
    } catch (e) {
      return '2027';
    }
  });

  useEffect(() => {
    const handleChanged = () => {
      try {
        setYear(localStorage.getItem('tast_any_edicio') || '2027');
      } catch (e) {
        // Safe fallback
      }
    };

    window.addEventListener('eventDataChanged', handleChanged);
    window.addEventListener('hoursConfigChanged', handleChanged);
    window.addEventListener('localStorage', handleChanged);
    window.addEventListener('storage', handleChanged);

    return () => {
      window.removeEventListener('eventDataChanged', handleChanged);
      window.removeEventListener('hoursConfigChanged', handleChanged);
      window.removeEventListener('localStorage', handleChanged);
      window.removeEventListener('storage', handleChanged);
    };
  }, []);

  return year;
}
