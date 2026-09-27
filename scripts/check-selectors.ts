/**
 * ตรวจว่า selector ใน `locators.ts` ตัวไหนใช้ได้จริงกับหน้าเว็บ timesheet
 *
 * ใช้สำหรับเติม TODO ใน spec ข้อ 12 — จะบอกว่าแต่ละองค์ประกอบเจอหรือไม่
 * เจอด้วย candidate ตัวที่เท่าไหร่ และ element ที่เจอหน้าตาเป็นยังไง
 * ถ้าไปถึง dropdown ได้ จะ **พ่นรายการ option ทั้งหมด** ออกมาให้เอาไปใส่ ATTENDANCE_TYPE_MAP
 *
 *   npm run check-selectors                        # ตรวจเฉพาะหน้า login
 *   npm run check-selectors -- --user=1            # login แล้วตรวจต่อจนถึงหน้าลงเวลา
 *   npm run check-selectors -- --user=1 --session=in --open-dialog
 *   npm run check-selectors -- --user=1 --headless # ไม่เปิดหน้าต่าง
 */

import "dotenv/config";
import { type Frame, type Locator, type Page, chromium } from "playwright";
import { LOCATORS, type LocatorSet } from "@/lib/attendance/locators";
import { loadUsers } from "@/lib/config/users";

type Scope = Page | Frame;

interface Args {
  userIndex?: number;
  session: "in" | "out";
  openDialog: boolean;
  headless: boolean;
}

function parseArgs(argv: string[]): Args {
  const get = (name: string): string | undefined =>
    argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];

  const rawUser = get("user");
  const rawSession = get("session");

  return {
    userIndex: rawUser ? Number(rawUser) : undefined,
    session: rawSession === "out" ? "out" : "in",
    openDialog: argv.includes("--open-dialog"),
    headless: argv.includes("--headless"),
  };
}

function scopes(page: Page): Array<{ scope: Scope; label: string }> {
  const main = page.mainFrame();
  return [
    { scope: page, label: "หน้าหลัก" },
    ...page
      .frames()
      .filter((f) => f !== main)
      .map((f, i) => ({ scope: f as Scope, label: `iframe#${i + 1} (${f.url().slice(0, 60)})` })),
  ];
}

/** อธิบายหน้าตาของ element ที่เจอ เพื่อให้เอาไปเขียน selector จริงได้ */
async function describe(locator: Locator): Promise<string> {
  try {
    // หมายเหตุ: อย่าประกาศ `const fn = () => {}` ในนี้ — tsx (esbuild keepNames)
    // จะแทรกตัวช่วย `__name` ที่ไม่มีอยู่ในฝั่งเบราว์เซอร์ ทำให้ evaluate พังทั้งก้อน
    return await locator.evaluate((el) => {
      const e = el as HTMLElement;
      const attrs = ["id", "name", "type", "placeholder", "class"]
        .map((n) => (e.getAttribute(n) ? ` ${n}="${e.getAttribute(n)}"` : ""))
        .join("");
      const text = (e.innerText || "").trim().replace(/\s+/g, " ").slice(0, 40);
      return `<${e.tagName.toLowerCase()}${attrs}>${text ? ` "${text}"` : ""}`;
    });
  } catch (error) {
    return `(อธิบายไม่ได้: ${error instanceof Error ? error.message : error})`;
  }
}

/** ไล่ทุก candidate แล้วรายงานว่าตัวไหนเจอ */
async function probe(page: Page, key: string, set: LocatorSet): Promise<Locator | undefined> {
  for (const { scope, label } of scopes(page)) {
    for (let i = 0; i < set.candidates.length; i++) {
      try {
        const locator = set.candidates[i](scope).first();
        if ((await locator.count()) === 0) continue;
        if (!(await locator.isVisible())) continue;

        const where = label === "หน้าหลัก" ? "" : ` [${label}]`;
        console.log(`  ✅ ${key.padEnd(22)} candidate #${i + 1}${where}`);
        console.log(`     ${set.name}: ${await describe(locator)}`);
        return locator;
      } catch {
        // candidate ใช้ไม่ได้ — ข้าม
      }
    }
  }

  console.log(`  ❌ ${key.padEnd(22)} ไม่เจอ — ${set.name}`);
  return undefined;
}

/** พ่นรายการ option ใน dropdown ออกมาทั้งหมด */
async function dumpOptions(dropdown: Locator): Promise<void> {
  const tag = await dropdown.evaluate((el) => el.tagName.toLowerCase());

  if (tag !== "select") {
    console.log(`     (เป็น dropdown แบบ custom <${tag}> — ต้องคลิกเปิดแล้วดู option เอง)`);
    return;
  }

  const options = await dropdown.evaluate((el) =>
    Array.from((el as HTMLSelectElement).options).map((o) => ({
      value: o.value,
      label: (o.textContent ?? "").trim(),
    })),
  );

  console.log(`\n  📋 option ใน dropdown (${options.length} รายการ) — เอาไปใส่ ATTENDANCE_TYPE_MAP:`);
  for (const option of options) {
    console.log(`     value="${option.value}"  label="${option.label}"`);
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const url = process.env.TIMESHEET_URL?.trim();

  if (!url) {
    console.error("❌ ไม่พบ TIMESHEET_URL ใน .env");
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: args.headless, slowMo: 150 });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "th-TH" });
  context.setDefaultTimeout(15_000);
  const page = await context.newPage();

  try {
    console.log(`\n🌐 เปิด ${url}\n`);
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2_000);

    console.log("── หน้า login ──");
    const username = await probe(page, "usernameInput", LOCATORS.usernameInput);
    const password = await probe(page, "passwordInput", LOCATORS.passwordInput);
    await probe(page, "submitButton", LOCATORS.submitButton);
    await probe(page, "loginScrollContainer", LOCATORS.loginScrollContainer);

    if (args.userIndex === undefined) {
      console.log("\n💡 อยากตรวจต่อหลัง login ให้ใส่ --user=1 (ต้องตั้งค่า USER_1_* ใน .env ก่อน)");
      return;
    }

    const user = loadUsers().find((u) => u.index === args.userIndex);
    if (!user) {
      console.error(`\n❌ ไม่พบผู้ใช้ลำดับ ${args.userIndex} ใน .env`);
      return;
    }
    if (!username || !password) {
      console.error("\n❌ หาช่อง username/password ไม่เจอ — login ต่อไม่ได้");
      return;
    }

    console.log(`\n── login ด้วย ${user.name} (${user.username}) ──`);
    await username.fill(user.username);
    await password.fill(user.password);

    const submit = await probe(page, "submitButton (อีกครั้ง)", LOCATORS.submitButton);
    if (!submit) return;
    await submit.click();
    await page.waitForLoadState("networkidle").catch(() => undefined);
    await page.waitForTimeout(2_000);

    console.log(`\n── หลัง login (url ปัจจุบัน: ${page.url()}) ──`);
    await probe(page, "loggedInMarker", LOCATORS.loggedInMarker);
    const openButton = await probe(
      page,
      args.session === "in" ? "timeInButton" : "timeOutButton",
      args.session === "in" ? LOCATORS.timeInButton : LOCATORS.timeOutButton,
    );

    if (!args.openDialog) {
      console.log("\n💡 อยากตรวจในหน้าต่างลงเวลาด้วย ให้ใส่ --open-dialog");
      console.log("   ⚠️ โหมดนั้นจะ *กดปุ่มจริง* แต่จะไม่กดยืนยัน");
      return;
    }
    if (!openButton) return;

    console.log(`\n── เปิดหน้าต่างลงเวลา (กดปุ่ม ${args.session === "in" ? "Time In" : "Time Out"}) ──`);
    await openButton.click();
    await page.waitForTimeout(2_000);

    await probe(page, "attendanceDialog", LOCATORS.attendanceDialog);
    const dropdown = await probe(page, "typeDropdown", LOCATORS.typeDropdown);
    if (dropdown) await dumpOptions(dropdown);
    await probe(page, "placeInput", LOCATORS.placeInput);
    await probe(
      page,
      args.session === "in" ? "confirmTimeIn" : "confirmTimeOut",
      args.session === "in" ? LOCATORS.confirmTimeInButton : LOCATORS.confirmTimeOutButton,
    );

    console.log("\n⚠️ ไม่ได้กดปุ่มยืนยัน — ไม่มีการลงเวลาจริงเกิดขึ้น");
  } finally {
    if (!args.headless) {
      console.log("\n⏸️  ปิดหน้าต่างใน 10 วินาที (ดูหน้าจอได้เลย)...");
      await page.waitForTimeout(10_000);
    }
    await context.close();
    await browser.close();
  }
}

main().catch((error: unknown) => {
  console.error("❌ เกิดข้อผิดพลาด:", error instanceof Error ? error.message : error);
  process.exit(1);
});
