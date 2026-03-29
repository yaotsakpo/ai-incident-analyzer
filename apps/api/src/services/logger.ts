type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  data?: any;
}

class Logger {
  private entries: LogEntry[] = [];
  private maxEntries = 1000;

  private log(level: LogLevel, message: string, data?: any) {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      data: data !== undefined ? (data instanceof Error ? { message: data.message, stack: data.stack } : data) : undefined,
    };
    this.entries.push(entry);
    if (this.entries.length > this.maxEntries) this.entries.shift();

    const prefix = `[${entry.timestamp}] [${level.toUpperCase()}]`;
    if (level === 'error') console.error(prefix, message, data || '');
    else if (level === 'warn') console.warn(prefix, message, data || '');
    else console.log(prefix, message, data !== undefined ? data : '');
  }

  debug(message: string, data?: any) { this.log('debug', message, data); }
  info(message: string, data?: any) { this.log('info', message, data); }
  warn(message: string, data?: any) { this.log('warn', message, data); }
  error(message: string, data?: any) { this.log('error', message, data); }

  getEntries(limit = 100): LogEntry[] {
    return this.entries.slice(-limit);
  }
}

export const logger = new Logger();
