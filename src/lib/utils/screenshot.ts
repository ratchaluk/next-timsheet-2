/** ถ่าย screenshot ตอนลงเวลาล้มเหลว — เก็บไว้ในหน่วยความจำเท่านั้น ไม่เขียนลงดิสก์ */

import type { Page } from "playwright";
import { createLogger, errorMessage } from "./logger";

const log = createLogger("screenshot");

/**
 * ถ่าย screenshot ของหน้าจอปัจจุบัน
 * คืนรูป PNG เป็น Buffer หรือ `undefined` ถ้าถ่ายไม่ได้ (เช่น page ถูกปิดไปแล้ว)
 */
export async function captureFailure(page: Page): Promise<Buffer | undefined> {
  try {
    return await page.screenshot({ fullPage: true });
  } catch (error) {
    log.warn(`ถ่าย screenshot ไม่สำเร็จ: ${errorMessage(error)}`);
    return undefined;
  }
}
