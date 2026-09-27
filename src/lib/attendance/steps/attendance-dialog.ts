/**
 * ขั้นตอนร่วมของ Time In / Time Out (spec ข้อ 7.2 และ 7.3)
 * ทั้งสองฝั่งทำเหมือนกันทุกอย่าง ต่างแค่ปุ่มที่กด จึงรวมไว้ที่เดียว
 *
 *   1. คลิกปุ่มเปิดหน้าต่าง (Time In / Time Out)
 *   2. เลือกประเภทการลงเวลาจาก dropdown
 *   3. กรอกสถานที่ลง textbox
 *   4. คลิกปุ่มยืนยัน
 */

import type { Locator, Page } from "playwright";
import type { Command, Session } from "@/types";
import { createLogger } from "../../utils/logger";
import { LOCATORS, type LocatorSet, findLocator, resolveLocator } from "../locators";
import { StepError, runStep } from "../step-error";

const log = createLogger("attendance");

interface SessionLocators {
  openButton: LocatorSet;
  confirmButton: LocatorSet;
}

const BY_SESSION: Record<Session, SessionLocators> = {
  in: { openButton: LOCATORS.timeInButton, confirmButton: LOCATORS.confirmTimeInButton },
  out: { openButton: LOCATORS.timeOutButton, confirmButton: LOCATORS.confirmTimeOutButton },
};

/**
 * เลือกตัวเลือกใน dropdown ด้วย "ข้อความ"
 * รองรับทั้ง `<select>` ปกติ และ dropdown ที่ทำด้วย JS (select2 / antd / MUI ฯลฯ)
 */
async function selectByLabel(page: Page, dropdown: Locator, label: string): Promise<void> {
  const tagName = await dropdown.evaluate((element) => element.tagName.toLowerCase());

  if (tagName === "select") {
    try {
      await dropdown.selectOption({ label });
      return;
    } catch {
      // ข้อความอาจไม่ตรงเป๊ะ (มีช่องว่าง/คำนำหน้า) — ลองจับแบบ "มีคำนี้อยู่"
      const optionValue = await dropdown.evaluate((element, wanted: string) => {
        const select = element as HTMLSelectElement;
        const match = Array.from(select.options).find((option) =>
          option.textContent?.trim().includes(wanted),
        );
        return match?.value;
      }, label);

      if (optionValue === undefined) {
        throw new StepError("select-type", `ไม่พบตัวเลือก "${label}" ใน dropdown`);
      }
      await dropdown.selectOption(optionValue);
      return;
    }
  }

  // dropdown แบบ custom: เปิดก่อน แล้วค่อยคลิกตัวเลือก
  await dropdown.click();
  const option = page.getByRole("option", { name: label }).first();

  if ((await option.count()) > 0) {
    await option.click();
    return;
  }

  const byText = page.getByText(label, { exact: false }).last();
  if ((await byText.count()) === 0) {
    throw new StepError("select-type", `ไม่พบตัวเลือก "${label}" ใน dropdown`);
  }
  await byText.click();
}

/** รันขั้นตอนลงเวลาทั้งชุดบนหน้าที่ login แล้ว */
export async function submitAttendance(
  page: Page,
  command: Command,
  timeoutMs: number,
): Promise<void> {
  const { openButton, confirmButton } = BY_SESSION[command.session];
  const sessionName = command.session === "in" ? "Time In" : "Time Out";

  await runStep("open-dialog", async () => {
    log.info(`คลิกปุ่ม ${sessionName}`);
    const button = await resolveLocator(page, openButton, timeoutMs);
    await button.click();
    // รอให้หน้าต่างลงเวลาเปิด (บางเว็บอาจไม่ใช่ dialog จริง จึงไม่บังคับ)
    await findLocator(page, LOCATORS.attendanceDialog, 3_000);
  });

  await runStep("select-type", async () => {
    log.info(`เลือกประเภท: ${command.typeLabel} (${command.typeCode})`);
    const dropdown = await resolveLocator(page, LOCATORS.typeDropdown, timeoutMs);
    await selectByLabel(page, dropdown, command.typeLabel);
  });

  await runStep("fill-place", async () => {
    log.info(`กรอกสถานที่: ${command.place}`);
    const placeInput = await resolveLocator(page, LOCATORS.placeInput, timeoutMs);
    await placeInput.fill(command.place);
  });

  await runStep("confirm", async () => {
    log.info(`ยืนยัน ${sessionName}`);
    const confirm = await resolveLocator(page, confirmButton, timeoutMs);
    await confirm.click();

    // ถือว่าสำเร็จเมื่อหน้าต่างลงเวลาปิดไป
    const dialog = await findLocator(page, LOCATORS.attendanceDialog, 2_000);
    if (dialog) {
      await dialog.waitFor({ state: "hidden", timeout: timeoutMs }).catch(() => {
        log.warn("หน้าต่างลงเวลายังไม่ปิด — อาจมีขั้นตอนเพิ่มเติมที่ยังไม่ได้รองรับ");
      });
    }
    await page.waitForLoadState("networkidle", { timeout: timeoutMs }).catch(() => undefined);
  });
}
