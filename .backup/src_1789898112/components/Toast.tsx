import React, { useEffect, useState } from 'react';

export interface ToastProps {
  id: string;
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
  position?: 'top-right' | 'bottom-right' | 'both';
  onClose?: (id: string) => void;
}

export const Toast: React.FC<ToastProps> = ({
  id,
  message,
  type = 'success',
  duration = 3000,
  position = 'top-right',
  onClose
}) => {
  const [isRemoving, setIsRemoving] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      handleClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [duration]);

  const handleClose = () => {
    setIsRemoving(true);
    // Wait for slide out / fade animation before actual unmount trigger
    setTimeout(() => {
      if (onClose) onClose(id);
    }, 200);
  };

  const isTop = position === 'top-right' || position === 'both';

  // Premium, glow-enhanced styling for dark-mode app
  const baseStyle = `
    pointer-events-auto
    flex items-center gap-3 px-4 py-3.5 rounded-xl shadow-2xl border 
    min-w-[300px] max-w-md z-[9999] transition-all duration-200 ease-in-out
  `;

  const animationClass = isRemoving
    ? 'opacity-0 scale-95 translate-x-12'
    : isTop
    ? 'animate-toast-in-top'
    : 'animate-toast-in-bottom';

  const typeStyle = {
    success: 'bg-zinc-950/95 border-emerald-500/30 text-zinc-100 custom-toast',
    error: 'bg-zinc-950/95 border-rose-500/30 text-zinc-100 custom-toast',
    warning: 'bg-zinc-950/95 border-amber-500/30 text-zinc-100 custom-toast',
    info: 'bg-zinc-950/95 border-sky-500/30 text-zinc-100 custom-toast'
  }[type];

  const iconColor = {
    success: 'text-emerald-400 bg-emerald-500/10',
    error: 'text-rose-400 bg-rose-500/10',
    warning: 'text-amber-400 bg-amber-500/10',
    info: 'text-sky-400 bg-sky-500/10'
  }[type];

  const icons = {
    success: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
      </svg>
    ),
    error: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
    warning: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    info: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  };

  return (
    <div className={`${baseStyle} ${typeStyle} ${animationClass}`} id={`toast-${id}`}>
      <div className={`p-1.5 rounded-lg shrink-0 ${iconColor}`}>
        {icons[type]}
      </div>
      <div className="flex-1 text-xs font-sans font-medium text-zinc-100">
        {message}
      </div>
      <button 
        onClick={handleClose}
        className="text-zinc-400 hover:text-zinc-200 p-1 rounded-lg hover:bg-zinc-800/50 transition-colors shrink-0"
        aria-label="Close"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
};
