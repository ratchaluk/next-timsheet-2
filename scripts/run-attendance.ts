/**
 * รันการลงเวลาด้วย Playwright ตรง ๆ จาก command line — ไม่ต้องผ่าน Telegram/webhook
 *
 * ใช้ code ชุดเดียวกับที่ webhook เรียก (runner → login → time-in/out)
 * ผลที่ได้จึงตรงกับตอนสั่งผ่านบอทจริง
 *
 *   npm run attend -- "/1-in-nm-B9"
 *   npm run attend -- "/1-in-nm-B9" --headed          # เปิดหน้าต่างให้ดู
 *   npm run attend -- "/1-in-nm-B9" --headed --slow=300
 *   npm run attend -- "/1-in-nm-B9" --debug           # เปิด Playwright Inspector (หยุดทีละ step)
 *   npm run attend -- "/*-in-tr-trainingcenter"       # ทุกคน (ต้องใส่ quote)
 */

import "dotenv/config";

interface Options {
  command: string;
  headed: boolean;
  debug: boolean;
  slowMs?: number;
}

function usage(): never {
  console.error(
    [
      "วิธีใช้: npm run attend -- \"<คำสั่ง>\" [--headed] [--slow=ms] [--debug]",
      "",
      "ตัวอย่าง:",
      '  npm run attend -- "/1-in-nm-B9"',
      '  npm run attend -- "/1-in-nm-B9" --headed --slow=300',
      '  npm run attend -- "/*-out-nm-B9"',
      "",
      "หมายเหตุ: ใส่ quote รอบคำสั่งเสมอ ไม่งั้น shell จะตีความ * เอง",
    ].join("\n"),
  );
  process.exit(1);
}

function parseArgs(argv: string[]): Options {
  const positional = argv.filter((arg) => !arg.startsWith("--"));
  const flags = argv.filter((arg) => arg.startsWith("--"));

  if (positional.length !== 1) usage();

  const slowFlag = flags.find((flag) => flag.startsWith("--slow"));
  const slowMs = slowFlag ? Number(slowFlag.split("=")[1] ?? 250) : undefined;
  if (slowMs !== undefined && (!Number.isInteger(slowMs) || slowMs < 0)) {
    console.error("❌ --slow ต้องเป็นจำนวนเต็ม (ms) เช่น --slow=300");
    process.exit(1);
  }

  return {
    command: positional[0],
    headed: flags.includes("--headed"),
    debug: flags.includes("--debug"),
    slowMs,
  };
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  // ตั้งค่า env ก่อน import module ที่อ่าน env (ทำผ่าน dynamic import ด้านล่าง)
  if (options.debug) {
    process.env.PWDEBUG = "1"; // เปิด Playwright Inspector — หยุดให้ดูทีละ action
    process.env.HEADLESS = "false";
  }
  if (options.headed) process.env.HEADLESS = "false";
  if (options.slowMs !== undefined) process.env.SLOW_MO_MS = String(options.slowMs);

  // ตอน debug เราจะนั่งดูทีละ step — ยืด timeout ยาว ๆ กันหมดเวลาระหว่างตรวจ
  // (ใช้ค่ามาก ๆ แทน 0 เพราะตัว resolveLocator ใช้ค่านี้เป็น deadline ของมันเอง)
  if (options.debug) process.env.NAV_TIMEOUT_MS = String(60 * 60 * 1000);

  const [{ parseCommand }, { resolveTargets, runAttendance }, messages] = await Promise.all([
    import("@/lib/telegram/command-parser"),
    import("@/lib/attendance/runner"),
    import("@/lib/telegram/messages"),
  ]);

  const parsed = parseCommand(options.command);
  if (!parsed.ok) {
    console.error(`❌ ${parsed.error}`);
    process.exit(1);
  }

  let targets;
  try {
    targets = resolveTargets(parsed.command);
  } catch (error) {
    console.error(`❌ ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }

  console.log(messages.acknowledged(parsed.command, targets));
  console.log("");

  const results = await runAttendance(parsed.command, targets);

  console.log("\n─── ผลลัพธ์ ───");
  console.log(messages.summary(results));

  const failed = results.filter((result) => !result.ok);
  if (failed.length > 0) {
    console.log(
      "\n💡 ถ้าพังเพราะหา element ไม่เจอ ให้แก้ selector ที่ src/lib/attendance/locators.ts",
    );
    console.log("   แล้วลองใหม่ด้วย --headed --slow=300 เพื่อดูว่าติดตรงไหน");
  }

  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((error: unknown) => {
  console.error("❌ เกิดข้อผิดพลาด:", error instanceof Error ? error.message : error);
  process.exit(1);
});
