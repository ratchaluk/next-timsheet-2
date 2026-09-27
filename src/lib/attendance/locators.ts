/**
 * Selector ของหน้าเว็บ timesheet — จุดเดียวที่ต้องแก้เมื่อหน้าเว็บเปลี่ยน
 *
 * ⚠️ ยังไม่ได้ verify กับหน้าเว็บจริง (spec ข้อ 12)
 *
 * แต่ละองค์ประกอบเก็บเป็น **ลิสต์ของ candidate เรียงตามลำดับความมั่นใจ**
 * `resolveLocator()` จะไล่ลองทีละตัวจนเจอตัวที่มองเห็นได้จริงบนหน้าจอ
 * (ไล่ทั้งหน้าหลักและทุก iframe) ทำให้ทนต่อการเดา selector ผิดได้ระดับหนึ่ง
 *
 * วิธีแก้เมื่อรู้ selector จริงแล้ว: เติม candidate ตัวจริงไว้ **บนสุด** ของลิสต์นั้น
 * เช่น `(scope) => scope.locator("#txtUsername")`
 */

import type { Frame, Locator, Page } from "playwright";

/** ขอบเขตที่ใช้ค้น — หน้าหลัก หรือ iframe ใดก็ได้ */
export type Scope = Page | Frame;

export type Candidate = (scope: Scope) => Locator;

export interface LocatorSet {
  /** ชื่อภาษาไทย ใช้ในข้อความ error */
  name: string;
  candidates: Candidate[];
}

function defineLocator(name: string, ...candidates: Candidate[]): LocatorSet {
  return { name, candidates };
}

export const LOCATORS = {
  // ── หน้า login ──────────────────────────────────────────────
  usernameInput: defineLocator(
    "ช่องกรอก username",
    (s) => s.getByRole("textbox", { name: /username/i }),
    (s) => s.getByRole("textbox", { name: /user\s*name/i }),
    (s) => s.getByRole("textbox", { name: /ผู้ใช้|รหัสพนักงาน/i }),
    (s) => s.getByLabel(/user\s*name|username|ผู้ใช้|รหัสพนักงาน/i),
    (s) => s.getByPlaceholder(/user\s*name|username|ผู้ใช้|รหัสพนักงาน/i),
    (s) => s.locator('input[name*="user" i]'),
    (s) => s.locator('input[id*="user" i]'),
    (s) => s.locator('input[type="text"]:visible'),
  ),

  passwordInput: defineLocator(
    "ช่องกรอก password",
    (s) => s.locator('input[type="password"]'),
    (s) => s.getByRole("textbox", { name: /password/i }),
    (s) => s.getByLabel(/password|รหัสผ่าน/i),
    (s) => s.getByPlaceholder(/password|รหัสผ่าน/i),
  ),

  submitButton: defineLocator(
    "ปุ่ม submit ของหน้า login",
    (s) => s.getByLabel(/login|เข้าสู่ระบบ/i),
    (s) => s.getByRole("button", { name: "Login", exact: true }),
    (s) => s.locator('#login-form button.btn-primary'),
    (s) => s.locator('button[type="submit"]'),
    (s) => s.locator('input[type="submit"]'),
  ),

  /**
   * กล่อง/หน้าต่างที่ต้อง scroll ลงก่อนกด submit (spec ข้อ 7.1)
   * ถ้าหาไม่เจอ ขั้นตอน scroll จะ fallback ไป scroll ทั้งหน้าแทน
   */
  loginScrollContainer: defineLocator(
    "กล่องที่ต้อง scroll ก่อน submit",
    (s) => s.locator("#p3"),
    (s) => s.getByRole("dialog"),
    (s) => s.locator('[role="dialog"], .modal, .modal-body, .terms, .consent'),
  ),

  /** ปุ่มยอมรับเงื่อนไขการใช้งาน — โผล่มาหลังกด Login (ตอนแรกซ่อนอยู่) */
  acceptTermsButton: defineLocator(
    "ปุ่มยอมรับเงื่อนไข",
    (s) => s.locator("#sub"),
    (s) => s.getByRole("button", { name: /ยอมรับเงื่อนไข/i }),
  ),
  /** สิ่งที่ปรากฏหลัง login สำเร็จ — ใช้ยืนยันว่าเข้าระบบได้แล้ว */
  loggedInMarker: defineLocator(
    "สัญญาณว่า login สำเร็จ",
    (s) => s.getByText(/ลงเวลาเข้างาน|ลงเวลาออกงาน/i),
    (s) => s.getByRole("link", { name: /logout|ออกจากระบบ/i }),
    (s) => s.getByText(/logout/i),
    (s) => s.getByRole("button", { name: /time\s*in|time\s*out/i }),
    (s) => s.getByText(/time\s*in|time\s*out/i),
    (s) => s.getByRole("button", { name: /log\s*out|ออกจากระบบ/i }),
  ),

  // ── ปุ่มเปิดหน้าลงเวลา ───────────────────────────────────────
  timeInButton: defineLocator(
    'ปุ่ม "Time In"',
    (s) => s.locator("#button_checkin"),
    (s) => s.getByTestId("button_checkin"),
    //(s) => s.getByText(/ลงเวลาเข้างาน/i),
    (s) => s.getByRole("button", { name: /time\s*in/i }),
    (s) => s.getByRole("link", { name: /time\s*in/i }),
    (s) => s.getByText(/^\s*time\s*in\s*$/i),
  ),

  timeOutButton: defineLocator(
    'ปุ่ม "Time Out"',
    (s) => s.locator("#button_checkout"),
    (s) => s.getByTestId("button_checkout"),
    //(s) => s.getByText(/ลงเวลาออกงาน/i),
    (s) => s.getByRole("button", { name: /time\s*out/i }),
    (s) => s.getByRole("link", { name: /time\s*out/i }),
    (s) => s.getByText(/^\s*time\s*out\s*$/i),
  ),

  // ── ในหน้าต่างลงเวลา ────────────────────────────────────────
  /** กล่อง dialog ที่เปิดขึ้นหลังกด Time In/Out — ใช้จำกัดขอบเขตการค้นหา */
  attendanceDialog: defineLocator(
    "หน้าต่างลงเวลา",
    (s) => s.getByRole("dialog"),
    (s) => s.locator('[role="dialog"], .modal.show, .modal[style*="block"], .swal2-popup'),
  ),

  typeDropdown: defineLocator(
    "dropdown ประเภทการลงเวลา",
    (s) => s.locator("select:visible"),
    (s) => s.getByTestId("activity"),
    (s) => s.getByRole("combobox"),
    (s) => s.locator('[role="combobox"], .select2-selection, .ant-select, .MuiSelect-select'),
  ),

  placeInput: defineLocator(
    "ช่องกรอกสถานที่",
    (s) => s.locator("#place"),
    (s) => s.getByTestId("place"),
    (s) => s.getByLabel(/place|location|สถานที่|สถานที่ปฏิบัติงาน/i),
    (s) => s.getByPlaceholder(/place|location|สถานที่/i),
    (s) => s.locator('input[name*="place" i], input[name*="location" i]'),
    (s) => s.locator('textarea:visible'),
    (s) => s.locator('input[type="text"]:visible'),
  ),

  confirmTimeInButton: defineLocator(
    'ปุ่มยืนยัน "Time In" ในหน้าต่าง',
    //(s) => s.getByText(/ลงเวลาเข้างาน/i),
    (s) => s.getByRole("dialog").getByRole("button", { name: /time\s*in|ยืนยัน|ตกลง|บันทึก|save|ลงเวลาเข้างาน/i }),
    (s) => s.getByRole("button", { name: /time\s*in/i }),
    (s) => s.getByRole("button", { name: /ยืนยัน|ตกลง|บันทึก|save|confirm|ลงเวลาเข้างาน/i }),
  ),

  confirmTimeOutButton: defineLocator(
    'ปุ่มยืนยัน "Time Out" ในหน้าต่าง',
    //(s) => s.getByText(/ลงเวลาออกงาน/i),
    (s) => s.getByRole("dialog").getByRole("button", { name: /time\s*out|ยืนยัน|ตกลง|บันทึก|save|ลงเวลาออกงาน/i }),
    (s) => s.getByRole("button", { name: /time\s*out/i }),
    (s) => s.getByRole("button", { name: /ยืนยัน|ตกลง|บันทึก|save|confirm|ลงเวลาออกงาน/i }),
  ),
} as const;

export class LocatorNotFoundError extends Error {
  constructor(locatorName: string) {
    super(`หา "${locatorName}" บนหน้าเว็บไม่เจอ — ตรวจ selector ใน src/lib/attendance/locators.ts`);
    this.name = "LocatorNotFoundError";
  }
}

/** หน้าหลัก + ทุก iframe */
function scopes(page: Page): Scope[] {
  const main = page.mainFrame();
  return [page, ...page.frames().filter((frame) => frame !== main)];
}

/** ลอง candidate 1 ตัว — คืน locator ถ้ามองเห็นได้จริง */
async function tryCandidate(scope: Scope, candidate: Candidate): Promise<Locator | undefined> {
  try {
    const locator = candidate(scope).first();
    if ((await locator.count()) === 0) return undefined;
    return (await locator.isVisible()) ? locator : undefined;
  } catch {
    // selector ผิดรูปแบบ หรือ frame ถูก detach ระหว่างค้น — ข้ามไปตัวถัดไป
    return undefined;
  }
}

/**
 * ไล่หา element ตามลำดับ candidate จนกว่าจะเจอหรือหมดเวลา
 * @throws {LocatorNotFoundError} เมื่อหาไม่เจอภายใน timeout
 */
export async function resolveLocator(
  page: Page,
  set: LocatorSet,
  timeoutMs: number,
): Promise<Locator> {
  const deadline = Date.now() + timeoutMs;

  for (;;) {
    for (const scope of scopes(page)) {
      for (const candidate of set.candidates) {
        const found = await tryCandidate(scope, candidate);
        if (found) return found;
      }
    }

    if (Date.now() >= deadline) break;
    await page.waitForTimeout(250);
  }

  throw new LocatorNotFoundError(set.name);
}

/** เหมือน `resolveLocator` แต่คืน `undefined` แทนการ throw — ใช้กับของที่มีหรือไม่มีก็ได้ */
export async function findLocator(
  page: Page,
  set: LocatorSet,
  timeoutMs: number,
): Promise<Locator | undefined> {
  try {
    return await resolveLocator(page, set, timeoutMs);
  } catch {
    return undefined;
  }
}
