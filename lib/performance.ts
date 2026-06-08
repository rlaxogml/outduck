export interface PerformanceLog {
  id: string;
  label: string;
  duration: number;
  type: 'client' | 'server' | 'api' | 'auth';
  timestamp: number;
}

class PerformanceTracker {
  addLog(log: Omit<PerformanceLog, 'timestamp'>) {
    // Disabled for production push
  }

  getLogs() {
    return [];
  }

  subscribe(listener: () => void) {
    return () => {};
  }

  clear() {
    // Disabled
  }
}

export const performanceTracker = new PerformanceTracker();

/**
 * Passes through the execution of the asynchronous function without profiling logs.
 */
export async function trackPerformance<T>(
  label: string,
  type: PerformanceLog['type'],
  fn: () => Promise<T>
): Promise<T> {
  return await fn();
}
