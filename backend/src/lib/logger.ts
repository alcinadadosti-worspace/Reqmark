/**
 * Log estruturado e enxuto.
 *
 * O plano gratuito do Render guarda pouco log, entao cada linha precisa render:
 * escopo, o que aconteceu e o identificador para rastrear.
 */
type Level = 'info' | 'warn' | 'error';

function emit(level: Level, scope: string, message: string, details?: unknown): void {
  const line = `[${new Date().toISOString()}] ${level.toUpperCase().padEnd(5)} ${scope} — ${message}`;

  if (details === undefined) {
    console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](line);
    return;
  }

  console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](line, details);
}

export function createLogger(scope: string) {
  return {
    info: (message: string, details?: unknown) => emit('info', scope, message, details),
    warn: (message: string, details?: unknown) => emit('warn', scope, message, details),
    error: (message: string, details?: unknown) => emit('error', scope, message, details),
  };
}

/** Extrai algo legivel de um `catch (error: unknown)`. */
export function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}
