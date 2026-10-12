import React, { createContext, useContext, useState, useCallback } from 'react';
import { Toast } from '../components/Toast';

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
  position?: 'top-right' | 'bottom-right' | 'both';
}

interface ToastContextType {
  toasts: ToastMessage[];
  showToast: (
    message: string | any,
    type?: 'success' | 'error' | 'warning' | 'info',
    duration?: number,
    position?: 'top-right' | 'bottom-right' | 'both'
  ) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((
    message: string | any,
    type: 'success' | 'error' | 'warning' | 'info' = 'success',
    duration = 3000,
    position: 'top-right' | 'bottom-right' | 'both' = 'top-right'
  ) => {
    let finalMessage = '';
    let finalType = type;

    if (typeof message === 'string') {
      finalMessage = message;
    } else if (message && typeof message === 'object') {
      if ('type' in message && ['success', 'error', 'warning', 'info'].includes(message.type)) {
        finalType = message.type;
      }
      if ('title' in message && 'description' in message && message.title && message.description) {
        finalMessage = `${message.title}: ${message.description}`;
      } else if ('title' in message && message.title) {
        finalMessage = String(message.title);
      } else if ('description' in message && message.description) {
        finalMessage = String(message.description);
      } else if ('message' in message && message.message) {
        finalMessage = typeof message.message === 'string' ? message.message : String(message.message);
      } else {
        finalMessage = String(message);
      }
    } else {
      finalMessage = String(message ?? '');
    }

    const id = Math.random().toString(36).substring(2, 9) + '-' + Date.now();
    const newToast: ToastMessage = { id, message: finalMessage, type: finalType, duration, position };
    setToasts((prev) => [...prev, newToast]);
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, showToast, removeToast }}>
      {children}
      
      {/* Floating Toast notifications list - Top Right */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.filter(t => t.position === 'top-right' || t.position === 'both' || !t.position).map(toast => (
          <Toast
            key={toast.id}
            id={toast.id}
            message={toast.message}
            type={toast.type}
            duration={toast.duration}
            position={toast.position}
            onClose={removeToast}
          />
        ))}
      </div>

      {/* Floating Toast notifications list - Bottom Right */}
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col-reverse gap-2 pointer-events-none">
        {toasts.filter(t => t.position === 'bottom-right').map(toast => (
          <Toast
            key={toast.id}
            id={toast.id}
            message={toast.message}
            type={toast.type}
            duration={toast.duration}
            position={toast.position}
            onClose={removeToast}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
