/** ลงเวลาเข้า (spec ข้อ 7.2) — กด Time In → เลือกประเภท → กรอกสถานที่ → ยืนยัน */

import type { Page } from "playwright";
import type { Command } from "@/types";
import { submitAttendance } from "./attendance-dialog";

export async function timeIn(page: Page, command: Command, timeoutMs: number): Promise<void> {
  await submitAttendance(page, { ...command, session: "in" }, timeoutMs);
}
