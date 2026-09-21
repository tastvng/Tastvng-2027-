import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { LanguageProvider } from './LanguageContext';
import { ToastProvider } from './hooks/useToast';
import './index.css';

// Capture and expose real error traces that might otherwise trigger generic "Script error." in iframe environments
window.onerror = (msg, src, line, col, err) => {
  console.warn('CAPTURED ERROR:', msg, src, line, col, err);
};

window.addEventListener('unhandledrejection', (event) => {
  const reason = event ? event.reason : null;
  // Prevent harmless or network-related rejections from breaking runtime
  if (reason) {
    console.warn('Handled Promise Rejection:', reason);
  }
  // Prevent default error bubbling if it's already handled or benign
  if (event && typeof event.preventDefault === 'function') {
    event.preventDefault();
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </LanguageProvider>
  </StrictMode>,
);

