/**
 * Webhook รับคำสั่งจาก Telegram
 *
 * สำคัญ: ตอบ 200 กลับ Telegram **ทันที** แล้วค่อยรัน Playwright ต่อผ่าน `after()`
 * เพราะการลงเวลา (โดยเฉพาะโหมด `*`) ใช้เวลานานกว่าที่ Telegram รอ
 * ถ้าตอบช้า Telegram จะ retry แล้วทำให้ลงเวลาซ้ำ
 */

import { after } from "next/server";
import { loadUsers } from "@/lib/config/users";
import { BusyError, resolveTargets, runAttendance } from "@/lib/attendance/runner";
import { isAllowedChat, isValidWebhookSecret } from "@/lib/telegram/auth";
import { trySendMessage, trySendPhoto } from "@/lib/telegram/bot";
import { parseCommand } from "@/lib/telegram/command-parser";
import * as messages from "@/lib/telegram/messages";
import { createLogger, errorMessage } from "@/lib/utils/logger";

// Playwright ต้องรันบน Node runtime (ไม่ใช่ Edge)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const log = createLogger("webhook");

interface TelegramUpdate {
  message?: {
    text?: string;
    chat?: { id?: number };
    from?: { username?: string };
  };
}

/** ดึง chat id + ข้อความออกจาก update (คืน undefined ถ้าไม่ใช่ข้อความที่สนใจ) */
function extract(update: TelegramUpdate): { chatId: number; text: string } | undefined {
  const chatId = update.message?.chat?.id;
  const text = update.message?.text?.trim();
  if (typeof chatId !== "number" || !text) return undefined;
  return { chatId, text };
}

/** จัดการคำสั่งช่วยเหลือ — คืน true ถ้าจัดการแล้ว */
async function handleUtilityCommand(chatId: number, text: string): Promise<boolean> {
  const command = text.toLowerCase().split(/[\s@]/)[0];

  if (command === "/start" || command === "/help") {
    await trySendMessage(chatId, messages.usage());
    return true;
  }

  if (command === "/users") {
    try {
      await trySendMessage(chatId, messages.userList(loadUsers()));
    } catch (error) {
      await trySendMessage(chatId, messages.unexpectedError(errorMessage(error)));
    }
    return true;
  }

  return false;
}

/** งานหลัก: parse → รัน Playwright → รายงานผล (ทำงานหลังตอบ 200 ไปแล้ว) */
async function handleUpdate(chatId: number, text: string): Promise<void> {
  if (await handleUtilityCommand(chatId, text)) return;

  const parsed = parseCommand(text);
  if (!parsed.ok) {
    await trySendMessage(chatId, messages.invalidCommand(parsed.error));
    return;
  }

  const command = parsed.command;

  try {
    const targets = resolveTargets(command);
    await trySendMessage(chatId, messages.acknowledged(command, targets));

    const results = await runAttendance(command, targets);

    await trySendMessage(chatId, messages.summary(results));

    // ส่ง screenshot ของทุกคนที่ล้มเหลว
    for (const result of results) {
      if (!result.ok && result.screenshot) {
        await trySendPhoto(chatId, result.screenshot, messages.failureLine(result));
      }
    }
  } catch (error) {
    if (error instanceof BusyError) {
      await trySendMessage(chatId, messages.busy());
      return;
    }
    log.error(`จัดการคำสั่งไม่สำเร็จ: ${errorMessage(error)}`);
    await trySendMessage(chatId, messages.unexpectedError(errorMessage(error)));
  }
}

export async function POST(request: Request): Promise<Response> {
  // 1) ตรวจ secret token ของ webhook
  try {
    if (!isValidWebhookSecret(request.headers.get("x-telegram-bot-api-secret-token"))) {
      log.warn("ปฏิเสธคำขอ: secret token ไม่ถูกต้อง");
      return new Response("forbidden", { status: 403 });
    }
  } catch (error) {
    // env ไม่ครบ — ตอบ 200 เพื่อไม่ให้ Telegram retry ซ้ำ ๆ แล้วให้ดู log แทน
    log.error(`ตั้งค่า .env ไม่ครบ: ${errorMessage(error)}`);
    return Response.json({ ok: true });
  }

  let update: TelegramUpdate;
  try {
    update = (await request.json()) as TelegramUpdate;
  } catch {
    return new Response("bad request", { status: 400 });
  }

  const extracted = extract(update);
  if (!extracted) return Response.json({ ok: true });

  const { chatId, text } = extracted;

  // 2) ตรวจสิทธิ์ chat id
  try {
    if (!isAllowedChat(chatId)) {
      log.warn(`ปฏิเสธคำสั่งจาก chat id ที่ไม่ได้รับอนุญาต: ${chatId}`);
      return Response.json({ ok: true });
    }
  } catch (error) {
    log.error(`ตั้งค่า .env ไม่ครบ: ${errorMessage(error)}`);
    return Response.json({ ok: true });
  }

  log.info(`รับคำสั่งจาก ${chatId}: ${text}`);

  // 3) ตอบ 200 ทันที แล้วรันงานจริงหลังจากนั้น
  after(async () => {
    try {
      await handleUpdate(chatId, text);
    } catch (error) {
      log.error(`งานเบื้องหลังล้มเหลว: ${errorMessage(error)}`);
    }
  });

  return Response.json({ ok: true });
}

/** ไว้เช็คว่า route ทำงานอยู่ (เปิดใน browser ได้) */
export function GET(): Response {
  return Response.json({ ok: true, service: "nt-timesheet-auto-attendance" });
}
