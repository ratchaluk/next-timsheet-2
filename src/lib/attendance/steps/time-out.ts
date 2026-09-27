/** ลงเวลาออก (spec ข้อ 7.3) — กด Time Out → เลือกประเภท → กรอกสถานที่ → ยืนยัน */

import type { Page } from "playwright";
import type { Command } from "@/types";
import { submitAttendance } from "./attendance-dialog";

export async function timeOut(page: Page, command: Command, timeoutMs: number): Promise<void> {
  await submitAttendance(page, { ...command, session: "out" }, timeoutMs);
}
