/**
 * จัดการ lifecycle ของ Playwright
 *
 * - เปิด browser 1 ตัวต่อ 1 คำสั่ง แล้วปิดเมื่อจบ
 * - แต่ละ user ใช้ context แยก เพื่อไม่ให้ cookie/session ของคนก่อนหน้าค้าง
 */

import { type Browser, type BrowserContext, type Page, chromium } from "playwright";
import { getBrowserEnv } from "../config/env";
import { createLogger, errorMessage } from "../utils/logger";
import { StepError } from "./step-error";

const log = createLogger("browser");

/** เปิด browser ให้ `fn` ใช้ แล้วปิดให้เสมอไม่ว่าจะสำเร็จหรือไม่ */
export async function withBrowser<T>(fn: (browser: Browser) => Promise<T>): Promise<T> {
  const { headless, slowMoMs } = getBrowserEnv();

  let browser: Browser;
  try {
    log.info(`เปิด Chromium (headless=${headless}${slowMoMs ? `, slowMo=${slowMoMs}ms` : ""})`);
    browser = await chromium.launch({ headless, slowMo: slowMoMs });
  } catch (error) {
    throw new StepError(
      "launch",
      `เปิดเบราว์เซอร์ไม่สำเร็จ: ${errorMessage(error)} — ลองรัน \`npx playwright install chromium\``,
      error,
    );
  }

  try {
    return await fn(browser);
  } finally {
    await browser.close().catch(() => log.warn("ปิด browser ไม่สำเร็จ"));
  }
}

/** เปิด context + page ใหม่สำหรับ user 1 คน แล้วปิดให้เสมอ */
export async function withPage<T>(
  browser: Browser,
  fn: (page: Page) => Promise<T>,
): Promise<T> {
  const { navTimeoutMs } = getBrowserEnv();

  let context: BrowserContext | undefined;
  try {
    context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      locale: "th-TH",
    });
    context.setDefaultTimeout(navTimeoutMs);
    context.setDefaultNavigationTimeout(navTimeoutMs);

    const page = await context.newPage();
    return await fn(page);
  } finally {
    await context?.close().catch(() => log.warn("ปิด context ไม่สำเร็จ"));
  }
}
