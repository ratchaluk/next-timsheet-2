/** client บาง ๆ สำหรับเรียก Telegram Bot API (ส่งข้อความ / ส่งรูป) */

import { getEnv } from "../config/env";
import { createLogger, errorMessage } from "../utils/logger";

const log = createLogger("telegram");

function apiUrl(method: string): string {
  return `https://api.telegram.org/bot${getEnv().telegramBotToken}/${method}`;
}

interface TelegramResponse {
  ok: boolean;
  description?: string;
}

async function call(method: string, body: BodyInit, headers?: HeadersInit): Promise<void> {
  const response = await fetch(apiUrl(method), { method: "POST", body, headers });
  const payload = (await response.json().catch(() => ({ ok: false }))) as TelegramResponse;

  if (!payload.ok) {
    throw new Error(`Telegram ${method} ล้มเหลว: ${payload.description ?? response.statusText}`);
  }
}

/** ส่งข้อความกลับไปที่ chat */
export async function sendMessage(chatId: number, text: string): Promise<void> {
  await call(
    "sendMessage",
    JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "Markdown",
      // ถ้า Markdown ในข้อความพัง Telegram จะ error — ปิด preview ไว้ก่อนอย่างน้อย
      link_preview_options: { is_disabled: true },
    }),
    { "content-type": "application/json" },
  );
}

/**
 * ส่งข้อความโดยไม่ parse Markdown
 * ใช้ตอน sendMessage ปกติล้มเหลวเพราะอักขระพิเศษในข้อความ error
 */
async function sendPlainMessage(chatId: number, text: string): Promise<void> {
  await call(
    "sendMessage",
    JSON.stringify({ chat_id: chatId, text, link_preview_options: { is_disabled: true } }),
    { "content-type": "application/json" },
  );
}

/** ส่งข้อความแบบไม่ throw — ถ้า Markdown พังจะ retry เป็นข้อความธรรมดา */
export async function trySendMessage(chatId: number, text: string): Promise<void> {
  try {
    await sendMessage(chatId, text);
  } catch (error) {
    log.warn(`ส่งข้อความแบบ Markdown ไม่สำเร็จ, ลองส่งแบบธรรมดา: ${errorMessage(error)}`);
    try {
      await sendPlainMessage(chatId, text);
    } catch (fallbackError) {
      log.error(`ส่งข้อความไม่สำเร็จ: ${errorMessage(fallbackError)}`);
    }
  }
}

/** ส่งรูป screenshot (PNG ในหน่วยความจำ) พร้อม caption */
export async function sendPhoto(chatId: number, photo: Buffer, caption: string): Promise<void> {
  const form = new FormData();
  form.append("chat_id", String(chatId));
  // caption ของ Telegram จำกัด 1024 ตัวอักษร
  form.append("caption", caption.slice(0, 1024));
  form.append("photo", new Blob([new Uint8Array(photo)], { type: "image/png" }), "screenshot.png");

  await call("sendPhoto", form);
}

/** ส่งรูปแบบไม่ throw — ถ้าส่งรูปไม่ได้ อย่างน้อยให้ข้อความไปถึง */
export async function trySendPhoto(chatId: number, photo: Buffer, caption: string): Promise<void> {
  try {
    await sendPhoto(chatId, photo, caption);
  } catch (error) {
    log.warn(`ส่งรูปไม่สำเร็จ: ${errorMessage(error)}`);
    await trySendMessage(chatId, `${caption}\n(แนบ screenshot ไม่สำเร็จ)`);
  }
}
