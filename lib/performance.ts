export interface PerformanceLog {
  id: string;
  label: string;
  duration: number;
  type: 'client' | 'server' | 'api' | 'auth';
  timestamp: number;
  pathname?: string;
}

class PerformanceTracker {
  private get listeners(): (() => void)[] {
    if (typeof window !== 'undefined') {
      if (!(window as any).__performance_listeners) {
        (window as any).__performance_listeners = [];
      }
      return (window as any).__performance_listeners;
    }
    return [];
  }

  private get logs(): PerformanceLog[] {
    if (typeof window !== 'undefined') {
      if (!(window as any).__performance_logs) {
        (window as any).__performance_logs = [];
      }
      return (window as any).__performance_logs;
    }
    return [];
  }

  addLog(log: Omit<PerformanceLog, 'id' | 'timestamp' | 'pathname'>) {
    const path = typeof window !== 'undefined' ? window.location.pathname : undefined;
    const newLog: PerformanceLog = {
      ...log,
      id: Math.random().toString(36).substring(2, 9),
      timestamp: Date.now(),
      pathname: path
    };
    // console.log("[PerformanceTracker] Added log:", newLog);
    this.logs.push(newLog);
    this.notify();
  }

  getLogs() {
    return [...this.logs];
  }

  subscribe(listener: () => void) {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  clear() {
    this.logs.length = 0;
    this.notify();
  }

  private notify() {
    this.listeners.forEach(l => l());
  }
}

export const performanceTracker = new PerformanceTracker();

export async function trackPerformance<T>(
  label: string,
  type: PerformanceLog['type'],
  fn: () => PromiseLike<T>
): Promise<T> {
  const start = performance.now();
  // console.log(`[trackPerformance] Starting task: ${label}`);
  try {
    const result = await fn();
    const duration = performance.now() - start;
    // console.log(`[trackPerformance] Task succeeded: ${label} in ${duration.toFixed(1)}ms`);
    performanceTracker.addLog({ label, type, duration });
    return result;
  } catch (err) {
    const duration = performance.now() - start;
    // console.log(`[trackPerformance] Task failed: ${label} in ${duration.toFixed(1)}ms`);
    performanceTracker.addLog({ label: `${label} (Failed)`, type, duration });
    throw err;
  }
}
