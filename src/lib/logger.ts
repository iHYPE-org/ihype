/**
 * Structured logger for iHYPE server-side code.
 *
 * Outputs JSON in production (easy to ingest by Sentry / log aggregators),
 * and colorized human-readable lines in development.
 *
 * Usage:
 *   import { log } from '@/lib/logger';
 *   log.info('[api/hype]', { userId, targetId }, 'Hype toggled');
 *   log.warn('[stripe/webhook]', { eventId }, 'Duplicate event dropped');
 *   log.error('[register]', error, 'Unexpected registration failure');
 */

type Level = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const isProd = process.env.NODE_ENV === 'production';
const minLevel: Level = (process.env.LOG_LEVEL as Level) ?? (isProd ? 'info' : 'debug');

function emit(level: Level, prefix: string, meta: Record<string, unknown> | Error | null, message?: string) {
  if (LEVELS[level] < LEVELS[minLevel]) return;

  const ts = new Date().toISOString();

  if (isProd) {
    // JSON for log aggregators
    const entry: Record<string, unknown> = {
      level,
      time: ts,
      prefix,
      msg: message ?? '',
    };

    if (meta instanceof Error) {
      entry['err'] = { message: meta.message, stack: meta.stack, name: meta.name };
    } else if (meta) {
      Object.assign(entry, meta);
    }

    const out = JSON.stringify(entry);
    if (level === 'error') process.stderr.write(out + '\n');
    else process.stdout.write(out + '\n');
  } else {
    // Human-readable for development
    const colors: Record<Level, string> = {
      debug: '\x1b[90m',   // grey
      info:  '\x1b[36m',   // cyan
      warn:  '\x1b[33m',   // yellow
      error: '\x1b[31m',   // red
    };
    const reset = '\x1b[0m';
    const color = colors[level];
    const metaStr = meta instanceof Error
      ? `\n${meta.stack}`
      : meta && Object.keys(meta).length
        ? ' ' + JSON.stringify(meta)
        : '';

    const line = `${color}${level.toUpperCase().padEnd(5)}${reset} ${ts} ${prefix}${message ? ' ' + message : ''}${metaStr}`;
    if (level === 'error') console.error(line);
    else if (level === 'warn') console.warn(line);
    else console.log(line);
  }
}

export const log = {
  debug: (prefix: string, meta?: Record<string, unknown> | null, message?: string) =>
    emit('debug', prefix, meta ?? null, message),
  info: (prefix: string, meta?: Record<string, unknown> | null, message?: string) =>
    emit('info', prefix, meta ?? null, message),
  warn: (prefix: string, meta?: Record<string, unknown> | null, message?: string) =>
    emit('warn', prefix, meta ?? null, message),
  error: (prefix: string, metaOrError?: Record<string, unknown> | Error | null, message?: string) =>
    emit('error', prefix, metaOrError ?? null, message),
};
