/**
 * Frontend logging utility that writes to browser's download folder
 * for debugging tool response flow issues
 */

interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  component: string;
  event: string;
  data?: any;
}

class FrontendLogger {
  private logs: LogEntry[] = [];
  private maxLogs = 1000;
  
  private formatTimestamp(): string {
    return new Date().toISOString();
  }
  
  private addLog(level: LogEntry['level'], component: string, event: string, data?: any) {
    const entry: LogEntry = {
      timestamp: this.formatTimestamp(),
      level,
      component,
      event,
      data: data ? JSON.parse(JSON.stringify(data)) : undefined
    };
    
    this.logs.push(entry);
    
    // Keep only the most recent logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
    
    // Also log to console for immediate debugging
    const consoleMethod = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
    console[consoleMethod](`[${component}] ${event}`, data);
  }
  
  info(component: string, event: string, data?: any) {
    this.addLog('info', component, event, data);
  }
  
  warn(component: string, event: string, data?: any) {
    this.addLog('warn', component, event, data);
  }
  
  error(component: string, event: string, data?: any) {
    this.addLog('error', component, event, data);
  }
  
  debug(component: string, event: string, data?: any) {
    this.addLog('debug', component, event, data);
  }
  
  /**
   * Download all logs as a JSON file
   */
  downloadLogs() {
    const logData = {
      exportedAt: this.formatTimestamp(),
      totalLogs: this.logs.length,
      logs: this.logs
    };
    
    const blob = new Blob([JSON.stringify(logData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `math-teacher-logs-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    URL.revokeObjectURL(url);
  }
  
  /**
   * Get recent logs for debugging
   */
  getRecentLogs(count: number = 50): LogEntry[] {
    return this.logs.slice(-count);
  }
  
  /**
   * Clear all logs
   */
  clearLogs() {
    this.logs = [];
    console.log('[Logger] All logs cleared');
  }
  
  /**
   * Get logs filtered by component
   */
  getLogsByComponent(component: string): LogEntry[] {
    return this.logs.filter(log => log.component === component);
  }
  
  /**
   * Get logs filtered by event type
   */
  getLogsByEvent(event: string): LogEntry[] {
    return this.logs.filter(log => log.event.includes(event));
  }
}

// Create singleton instance
export const logger = new FrontendLogger();

// Add global access for debugging in browser console
if (typeof window !== 'undefined') {
  (window as any).mathTeacherLogger = logger;
  console.log('Math Teacher Logger available at window.mathTeacherLogger');
  console.log('Use mathTeacherLogger.downloadLogs() to download logs');
}