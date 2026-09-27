/**
 * Orchestrator — วน user ทีละคนแล้วสั่ง Playwright ลงเวลา
 *
 * - รัน **sequential** ตาม spec ข้อ 3 (ลดภาระเครื่อง + เลี่ยง session ชนกัน)
 * - คนที่ล้มเหลวไม่ทำให้คนอื่นหยุด (spec ข้อ 9)
 * - มี lock กันไม่ให้สองคำสั่งเปิด browser พร้อมกัน
 */

import type { Browser } from "playwright";
import type { AttendanceResult, Command, UserAccount } from "@/types";
import { loadUsers, selectUsers } from "../config/users";
import { createLogger, errorMessage } from "../utils/logger";
import { captureFailure } from "../utils/screenshot";
import { withBrowser, withPage } from "./automation";
import { getBrowserEnv } from "../config/env";
import { StepError } from "./step-error";
import { login } from "./steps/login";
import { timeIn } from "./steps/time-in";
import { timeOut } from "./steps/time-out";

const log = createLogger("runner");

/** งานที่กำลังรันอยู่ — ใช้กันคำสั่งซ้อน */
let activeRun: Promise<AttendanceResult[]> | null = null;

export function isRunning(): boolean {
  return activeRun !== null;
}

/** หาผู้ใช้เป้าหมายจากคำสั่ง (throw ถ้าลำดับไม่มีอยู่จริง) */
export function resolveTargets(command: Command): UserAccount[] {
  return selectUsers(loadUsers(), command.selector);
}

/** ลงเวลาให้ผู้ใช้ 1 คน — ไม่ throw, คืนผลเสมอ */
async function runForUser(
  browser: Browser,
  user: UserAccount,
  command: Command,
): Promise<AttendanceResult> {
  const startedAt = Date.now();
  const { navTimeoutMs } = getBrowserEnv();

  const base = { user, session: command.session } as const;

  try {
    return await withPage(browser, async (page) => {
      try {
        await login(page, user, navTimeoutMs);

        if (command.session === "in") {
          await timeIn(page, command, navTimeoutMs);
        } else {
          await timeOut(page, command, navTimeoutMs);
        }

        log.info(`สำเร็จ: ${user.name}`);
        return { ...base, ok: true, durationMs: Date.now() - startedAt };
      } catch (error) {
        // ถ่าย screenshot ก่อน context ถูกปิด
        const screenshot = await captureFailure(page);
        const step = error instanceof StepError ? error.step : undefined;

        log.error(`ล้มเหลว: ${user.name} (${step ?? "ไม่ทราบขั้นตอน"}) — ${errorMessage(error)}`);

        return {
          ...base,
          ok: false,
          failedStep: step,
          error: errorMessage(error),
          screenshot,
          durationMs: Date.now() - startedAt,
        };
      }
    });
  } catch (error) {
    // พังตั้งแต่เปิด context/page — ยังไม่มีหน้าจอให้ถ่าย
    return {
      ...base,
      ok: false,
      failedStep: error instanceof StepError ? error.step : "launch",
      error: errorMessage(error),
      durationMs: Date.now() - startedAt,
    };
  }
}

async function execute(command: Command, targets: UserAccount[]): Promise<AttendanceResult[]> {
  const results: AttendanceResult[] = [];

  await withBrowser(async (browser) => {
    for (const user of targets) {
      log.info(`เริ่มลงเวลา ${command.session} ให้ ${user.name} (ลำดับ ${user.index})`);
      results.push(await runForUser(browser, user, command));
    }
  });

  return results;
}

export class BusyError extends Error {
  constructor() {
    super("มีคำสั่งลงเวลากำลังทำงานอยู่");
    this.name = "BusyError";
  }
}

/**
 * รันคำสั่งลงเวลา
 * @throws {BusyError} ถ้ามีคำสั่งอื่นกำลังรันอยู่
 */
export async function runAttendance(
  command: Command,
  targets: UserAccount[],
): Promise<AttendanceResult[]> {
  if (activeRun) throw new BusyError();

  const run = execute(command, targets).finally(() => {
    activeRun = null;
  });
  activeRun = run;
  return run;
}
