import { Injectable, LoggerService } from '@nestjs/common';

type LogLevel = 'fatal' | 'error' | 'warn' | 'log' | 'debug' | 'verbose';

interface LogRecord {
  timestamp: string;
  level: LogLevel;
  message: unknown;
  context?: string;
  trace?: string;
  metadata?: unknown[];
  pid: number;
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  fatal: 0,
  error: 1,
  warn: 2,
  log: 3,
  debug: 4,
  verbose: 5,
};

const ENV_LEVEL_MAP: Record<string, LogLevel> = {
  fatal: 'fatal',
  error: 'error',
  warn: 'warn',
  warning: 'warn',
  info: 'log',
  log: 'log',
  debug: 'debug',
  verbose: 'verbose',
  trace: 'verbose',
};

@Injectable()
export class JsonLoggerService implements LoggerService {
  private readonly minLevel: LogLevel;

  constructor() {
    const envLevel = (process.env.LOG_LEVEL ?? '').toLowerCase();
    this.minLevel =
      ENV_LEVEL_MAP[envLevel] ??
      (process.env.NODE_ENV === 'production' ? 'log' : 'debug');
  }

  log(message: unknown, ...optionalParams: unknown[]): void {
    this.write('log', message, optionalParams);
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    this.write('error', message, optionalParams);
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    this.write('warn', message, optionalParams);
  }

  debug(message: unknown, ...optionalParams: unknown[]): void {
    this.write('debug', message, optionalParams);
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    this.write('verbose', message, optionalParams);
  }

  fatal(message: unknown, ...optionalParams: unknown[]): void {
    this.write('fatal', message, optionalParams);
  }

  private write(
    level: LogLevel,
    message: unknown,
    optionalParams: unknown[],
  ): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const { context, trace, metadata } = this.parseOptionalParams(
      level,
      optionalParams,
    );

    const record: LogRecord = {
      timestamp: new Date().toISOString(),
      level,
      message: this.normalizeMessage(message),
      pid: process.pid,
      ...(context && { context }),
      ...(trace && { trace }),
      ...(metadata.length > 0 && { metadata }),
    };

    const line = `${this.safeStringify(record)}\n`;

    if (level === 'error' || level === 'fatal') {
      process.stderr.write(line);
      return;
    }

    process.stdout.write(line);
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] <= LOG_LEVEL_PRIORITY[this.minLevel];
  }

  private normalizeMessage(message: unknown): unknown {
    if (message instanceof Error) {
      return {
        name: message.name,
        message: message.message,
        stack: message.stack,
      };
    }

    return message;
  }

  private parseOptionalParams(
    level: LogLevel,
    optionalParams: unknown[],
  ): { context?: string; trace?: string; metadata: unknown[] } {
    if (optionalParams.length === 0) {
      return { metadata: [] };
    }

    const params = [...optionalParams];
    let context: string | undefined;
    let trace: string | undefined;

    if (typeof params[params.length - 1] === 'string') {
      context = params.pop() as string;
    }

    if (level === 'error' && typeof params[0] === 'string') {
      trace = params.shift() as string;
    }

    if (level === 'error' && params[0] instanceof Error) {
      const err = params.shift() as Error;
      trace = err.stack ?? err.message;
    }

    return {
      ...(context && { context }),
      ...(trace && { trace }),
      metadata: params,
    };
  }

  private safeStringify(value: unknown): string {
    const seen = new WeakSet<object>();

    return JSON.stringify(value, (_key, currentValue: unknown) => {
      if (typeof currentValue === 'object' && currentValue !== null) {
        if (seen.has(currentValue)) {
          return '[Circular]';
        }

        seen.add(currentValue);
      }

      if (currentValue instanceof Error) {
        return {
          name: currentValue.name,
          message: currentValue.message,
          stack: currentValue.stack,
        };
      }

      if (typeof currentValue === 'bigint') {
        return currentValue.toString();
      }

      return currentValue;
    });
  }
}
