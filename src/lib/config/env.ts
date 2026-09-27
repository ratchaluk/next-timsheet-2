/**
 * โหลด + validate environment variables
 *
 * ทุกอย่างอ่านแบบ lazy (ตอนเรียกฟังก์ชัน) ไม่ throw ตอน import
 * เพื่อให้ `next build` ผ่านได้แม้ยังไม่มีไฟล์ `.env`
 */

export interface AppEnv {
  timesheetUrl: string;
  telegramBotToken: string;
  /** chat id ที่อนุญาตให้สั่งงานบอท */
  allowedChatIds: number[];
  /** secret token ของ webhook (ไม่บังคับ แต่แนะนำให้ตั้ง) */
  webhookSecret?: string;
  headless: boolean;
  navTimeoutMs: number;
  /** หน่วงเวลาระหว่างแต่ละ action (ms) — ใช้ตอนดูเบราว์เซอร์ทำงานเพื่อหา selector */
  slowMoMs: number;
  publicUrl?: string;
  port: number;
}

export class EnvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EnvError";
  }
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new EnvError(`ไม่พบค่า ${name} ใน .env — กรุณาตั้งค่าก่อนใช้งาน`);
  }
  return value;
}

function optional(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function boolean(name: string, fallback: boolean): boolean {
  const value = optional(name)?.toLowerCase();
  if (value === undefined) return fallback;
  if (value === "true" || value === "1" || value === "yes") return true;
  if (value === "false" || value === "0" || value === "no") return false;
  throw new EnvError(`ค่า ${name} ต้องเป็น true หรือ false (ได้รับ "${value}")`);
}

function integer(name: string, fallback: number, options?: { allowZero?: boolean }): number {
  const value = optional(name);
  if (value === undefined) return fallback;
  const parsed = Number(value);
  const min = options?.allowZero ? 0 : 1;
  if (!Number.isInteger(parsed) || parsed < min) {
    const expected = options?.allowZero ? "จำนวนเต็ม 0 ขึ้นไป" : "จำนวนเต็มบวก";
    throw new EnvError(`ค่า ${name} ต้องเป็น${expected} (ได้รับ "${value}")`);
  }
  return parsed;
}

function chatIds(name: string): number[] {
  const raw = required(name);
  const ids = raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const parsed = Number(part);
      if (!Number.isInteger(parsed)) {
        throw new EnvError(`ค่า ${name} มี chat id ที่ไม่ใช่ตัวเลข: "${part}"`);
      }
      return parsed;
    });

  if (ids.length === 0) {
    throw new EnvError(`ค่า ${name} ต้องมีอย่างน้อย 1 chat id`);
  }
  return ids;
}

/** อ่าน env ทั้งชุด — throw `EnvError` ถ้าค่าที่จำเป็นขาดหรือผิดรูปแบบ */
export function getEnv(): AppEnv {
  return {
    timesheetUrl: required("TIMESHEET_URL"),
    telegramBotToken: required("TELEGRAM_BOT_TOKEN"),
    allowedChatIds: chatIds("TELEGRAM_ALLOWED_CHAT_IDS"),
    webhookSecret: optional("TELEGRAM_WEBHOOK_SECRET"),
    headless: boolean("HEADLESS", true),
    navTimeoutMs: integer("NAV_TIMEOUT_MS", 30_000),
    slowMoMs: integer("SLOW_MO_MS", 0, { allowZero: true }),
    publicUrl: optional("PUBLIC_URL"),
    port: integer("PORT", 3000),
  };
}

/** อ่านเฉพาะค่าที่ Playwright ต้องใช้ (ไม่ต้องมี token ของ Telegram) */
export function getBrowserEnv(): Pick<
  AppEnv,
  "timesheetUrl" | "headless" | "navTimeoutMs" | "slowMoMs"
> {
  return {
    timesheetUrl: required("TIMESHEET_URL"),
    headless: boolean("HEADLESS", true),
    navTimeoutMs: integer("NAV_TIMEOUT_MS", 30_000),
    slowMoMs: integer("SLOW_MO_MS", 0, { allowZero: true }),
  };
}
