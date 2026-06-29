import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { LanguageProvider } from './LanguageContext';
import { ToastProvider } from './hooks/useToast';
import './index.css';

// Capture and expose real error traces that might otherwise trigger generic "Script error." in iframe environments
window.onerror = (msg, src, line, col, err) => {
  console.error('CAPTURED ERROR:', msg, src, line, col, err);
};
window.onunhandledrejection = (e) => {
  console.error('UNHANDLED PROMISE:', e ? e.reason : 'Unknown reason');
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </LanguageProvider>
  </StrictMode>,
);

