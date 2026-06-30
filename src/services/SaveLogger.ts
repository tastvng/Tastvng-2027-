export interface SaveLog {
  id: string;
  timestamp: string;
  page: string;
  action: string;
  status: 'success' | 'error';
  details?: string;
  errorMessage?: string;
}

class SaveLogger {
  private logs: SaveLog[] = [];
  private maxLogs = 50; // Guardar últimos 50

  constructor() {
    this.loadFromLocalStorage();
  }

  log(
    page: string,
    action: string,
    status: 'success' | 'error',
    details?: string,
    errorMessage?: string
  ) {
    const log: SaveLog = {
      id: Date.now().toString() + '-' + Math.random().toString(36).substring(2, 5),
      timestamp: new Date().toISOString(),
      page,
      action,
      status,
      details,
      errorMessage
    };

    this.logs.unshift(log);
    
    // Mantener solo los últimos 50
    if (this.logs.length > this.maxLogs) {
      this.logs.pop();
    }

    // Log en console para debug
    console.log(`[SaveLogger] ${page} - ${action}:`, {
      status,
      timestamp: new Date(log.timestamp).toLocaleTimeString(),
      details,
      errorMessage
    });

    // Guardar en localStorage para persistencia
    this.persistToLocalStorage();
    
    // Dispatch custom event to notify listeners
    window.dispatchEvent(new CustomEvent('saveLoggerUpdate', { detail: log }));
  }

  getLogs(): SaveLog[] {
    return this.logs;
  }

  getRecentLogs(count = 10): SaveLog[] {
    return this.logs.slice(0, count);
  }

  clearLogs() {
    this.logs = [];
    localStorage.removeItem('saveLogger');
    window.dispatchEvent(new CustomEvent('saveLoggerUpdate', { detail: null }));
  }

  private persistToLocalStorage() {
    try {
      localStorage.setItem('saveLogger', JSON.stringify(this.logs));
    } catch (e) {
      console.warn('Could not persist logs to localStorage', e);
    }
  }

  private loadFromLocalStorage() {
    try {
      const stored = localStorage.getItem('saveLogger');
      if (stored) {
        this.logs = JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Could not load logs from localStorage', e);
    }
  }
}

export const saveLogger = new SaveLogger();
