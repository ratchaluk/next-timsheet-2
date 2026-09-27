/** logger แบบง่าย ๆ ใส่ timestamp + prefix ให้ตาม log ได้ว่าใครทำอะไร */

type Level = "info" | "warn" | "error";

function stamp(): string {
  return new Date().toISOString();
}

function write(level: Level, scope: string, message: string, extra?: unknown): void {
  const line = `[${stamp()}] [${level.toUpperCase()}] [${scope}] ${message}`;
  const fn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  if (extra === undefined) {
    fn(line);
  } else {
    fn(line, extra);
  }
}

export interface Logger {
  info(message: string, extra?: unknown): void;
  warn(message: string, extra?: unknown): void;
  error(message: string, extra?: unknown): void;
  child(childScope: string): Logger;
}

export function createLogger(scope: string): Logger {
  return {
    info: (message, extra) => write("info", scope, message, extra),
    warn: (message, extra) => write("warn", scope, message, extra),
    error: (message, extra) => write("error", scope, message, extra),
    child: (childScope) => createLogger(`${scope}:${childScope}`),
  };
}

/** ดึงข้อความจาก error ที่เป็นอะไรก็ได้ */
export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
