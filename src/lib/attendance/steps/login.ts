/**
 * ขั้นตอน login (spec ข้อ 7.1)
 *   1. เปิด TIMESHEET_URL
 *   2. กรอก username / password
 *   3. scroll ลงในหน้าต่างที่แสดง
 *   4. คลิกปุ่ม submit
 */

import type { Page } from "playwright";
import type { UserAccount } from "@/types";
import { createLogger } from "../../utils/logger";
import { LOCATORS, findLocator, resolveLocator } from "../locators";
import { StepError, runStep } from "../step-error";

const log = createLogger("login");

/**
 * scroll ลงล่างสุด
 * ถ้าเจอกล่อง dialog จะ scroll ในกล่องนั้น ไม่งั้น scroll ทั้งหน้า
 */
async function scrollToBottom(page: Page, timeoutMs: number): Promise<void> {
  const container = await findLocator(page, LOCATORS.loginScrollContainer, 2_000);

  if (container) {
    log.info("scroll ภายในกล่องที่แสดงอยู่");
    await container.evaluate((element: HTMLElement) => {
      element.scrollTop = element.scrollHeight;
      // เผื่อกรณีตัวที่ scroll ได้จริงเป็น element ลูก
      element.querySelectorAll<HTMLElement>("*").forEach((child) => {
        child.scrollTop = child.scrollHeight;
      });
    });
  } else {
    log.info("ไม่เจอกล่องเฉพาะ — scroll ทั้งหน้าแทน");
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.keyboard.press("End").catch(() => undefined);
  }

  // เผื่อปุ่ม submit เพิ่งถูกเปิดใช้งานหลัง scroll
  await page.waitForTimeout(Math.min(1_000, timeoutMs));
}

export async function login(page: Page, user: UserAccount, timeoutMs: number): Promise<void> {
  const url = process.env.TIMESHEET_URL?.trim();
  if (!url) throw new StepError("login", "ไม่พบค่า TIMESHEET_URL ใน .env");

  await runStep("login", async () => {
    log.info(`เปิดหน้า timesheet สำหรับ ${user.username}`);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });

    const usernameInput = await resolveLocator(page, LOCATORS.usernameInput, timeoutMs);
    await usernameInput.fill(user.username);

    const passwordInput = await resolveLocator(page, LOCATORS.passwordInput, timeoutMs);
    await passwordInput.fill(user.password);

    await scrollToBottom(page, timeoutMs);

    const submitButton = await resolveLocator(page, LOCATORS.submitButton, timeoutMs);
    await submitButton.click();

    // รอให้หน้าเปลี่ยนหลัง submit
    await page.waitForLoadState("networkidle", { timeout: timeoutMs }).catch(() => {
      log.warn("รอ networkidle ไม่สำเร็จ — ทำงานต่อ");
    });

    // หน้าเว็บแสดงเงื่อนไขการใช้งานหลังกด Login — ต้อง scroll กล่องเงื่อนไขให้สุด
    // ปุ่ม "ยอมรับเงื่อนไข" (#sub) ถึงจะปลด disabled แล้วกดได้
    const acceptButton = await findLocator(page, LOCATORS.acceptTermsButton, 5_000);
    if (acceptButton) {
      log.info("พบปุ่มยอมรับเงื่อนไข — scroll กล่องเงื่อนไขให้สุดเพื่อปลด disabled");
      await scrollToBottom(page, timeoutMs);

      await page
        .waitForFunction(
          () => {
            const b = document.getElementById("sub") as HTMLButtonElement | null;
            return b !== null && !b.disabled;
          },
          undefined,
          { timeout: 10_000 },
        )
        .catch(() => log.warn("ปุ่มยอมรับเงื่อนไขยัง disabled — ลองกดทั้งอย่างนั้น"));

      await acceptButton.scrollIntoViewIfNeeded().catch(() => undefined);
      await acceptButton.click();
      await page.waitForLoadState("networkidle", { timeout: timeoutMs }).catch(() => {
        log.warn("รอ networkidle หลังยอมรับเงื่อนไขไม่สำเร็จ — ทำงานต่อ");
      });
    } else {
      log.info("ไม่พบปุ่มยอมรับเงื่อนไข — ข้ามขั้นตอนนี้");
    }

    // ยืนยันว่า login ผ่านจริง ไม่ใช่ค้างอยู่หน้าเดิมเพราะรหัสผิด
    const marker = await findLocator(page, LOCATORS.loggedInMarker, timeoutMs);
    if (!marker) {
      throw new StepError(
        "login",
        `login ไม่สำเร็จสำหรับ ${user.username} — ตรวจ username/password หรือ selector ใน locators.ts`,
      );
    }

    log.info(`login สำเร็จ: ${user.username}`);
  });
}
