/** ตรวจสิทธิ์ผู้สั่งงาน — รับเฉพาะ chat id ที่ระบุใน TELEGRAM_ALLOWED_CHAT_IDS */

import { getEnv } from "../config/env";

export function isAllowedChat(chatId: number): boolean {
  return getEnv().allowedChatIds.includes(chatId);
}

/**
 * ตรวจ secret token ของ webhook (header `x-telegram-bot-api-secret-token`)
 *
 * ถ้าไม่ได้ตั้ง TELEGRAM_WEBHOOK_SECRET ไว้ จะข้ามการตรวจ
 * (ยังปลอดภัยระดับหนึ่งเพราะมีการกรอง chat id อีกชั้น)
 */
export function isValidWebhookSecret(headerValue: string | null): boolean {
  const expected = getEnv().webhookSecret;
  if (!expected) return true;
  return headerValue === expected;
}
