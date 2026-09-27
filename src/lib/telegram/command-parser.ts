/**
 * parse + validate คำสั่ง `/[user]-[session]-[type]-[place]`
 *
 * ตัวอย่าง:
 *   /1-in-nm-B9              → user 1, ลงเข้า, ปกติ, ที่ B9
 *   /*-in-tr-trainingcenter  → ทุกคน, ลงเข้า, อบรม, ที่ trainingcenter
 *
 * `place` เป็น free text จึงอนุญาตให้มี `-` และช่องว่างได้
 * (ตัดเอาทุกอย่างหลัง dash ตัวที่ 3 เป็น place)
 */

import type { Command, Session, UserSelector } from "@/types";
import { UnknownTypeError, listTypeCodes, resolveTypeLabel } from "../attendance/types";

export type ParseResult =
  | { ok: true; command: Command }
  | { ok: false; error: string };

/** `/1-in-nm-B9` → ["1", "in", "nm", "B9"] */
const COMMAND_PATTERN = /^\/(\*|\d+)-([a-zA-Z]+)-([a-zA-Z0-9_]+)-(.+)$/;

/** ตัด `@BotName` ที่ Telegram แปะท้ายคำสั่งในกลุ่มออก */
function stripBotMention(text: string): string {
  return text.replace(/@[A-Za-z0-9_]{3,}bot\b/i, "").trim();
}

function parseSession(raw: string): Session | undefined {
  const value = raw.toLowerCase();
  if (value === "in" || value === "out") return value;
  return undefined;
}

function parseSelector(raw: string): UserSelector | undefined {
  if (raw === "*") return "*";
  const parsed = Number(raw);
  if (Number.isInteger(parsed) && parsed > 0) return parsed;
  return undefined;
}

export function parseCommand(input: string): ParseResult {
  // สนใจเฉพาะบรรทัดแรก เผื่อผู้ใช้พิมพ์ข้อความอื่นต่อท้าย
  const firstLine = input.trim().split(/\r?\n/)[0];
  const text = stripBotMention(firstLine);

  if (!text.startsWith("/")) {
    return { ok: false, error: "คำสั่งต้องขึ้นต้นด้วย /" };
  }

  const match = COMMAND_PATTERN.exec(text);
  if (!match) {
    return {
      ok: false,
      error: "รูปแบบคำสั่งไม่ถูกต้อง — ต้องเป็น /[user]-[session]-[type]-[place]",
    };
  }

  const [, rawSelector, rawSession, rawType, rawPlace] = match;

  const selector = parseSelector(rawSelector);
  if (selector === undefined) {
    return { ok: false, error: `ลำดับผู้ใช้ "${rawSelector}" ไม่ถูกต้อง — ใช้ตัวเลข (1, 2, …) หรือ *` };
  }

  const session = parseSession(rawSession);
  if (!session) {
    return { ok: false, error: `ค่า session "${rawSession}" ไม่ถูกต้อง — ใช้ in หรือ out เท่านั้น` };
  }

  const place = rawPlace.trim();
  if (!place) {
    return { ok: false, error: "ต้องระบุสถานที่ (place)" };
  }

  try {
    const { code, label } = resolveTypeLabel(rawType);
    return {
      ok: true,
      command: { selector, session, typeCode: code, typeLabel: label, place, raw: text },
    };
  } catch (error) {
    if (error instanceof UnknownTypeError) {
      return {
        ok: false,
        error: `ไม่รู้จักประเภท "${error.code}" — ที่ใช้ได้: ${listTypeCodes().join(", ")}`,
      };
    }
    throw error;
  }
}
