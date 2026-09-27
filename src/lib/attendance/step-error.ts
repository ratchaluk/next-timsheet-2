/** error ที่พ่วงข้อมูลว่าล้มเหลวที่ขั้นตอนไหน เพื่อรายงานกลับ Telegram ได้ตรงจุด */

import type { AttendanceStep } from "@/types";
import { errorMessage } from "../utils/logger";

export class StepError extends Error {
  constructor(
    public readonly step: AttendanceStep,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "StepError";
  }
}

/** ครอบการทำงาน 1 ขั้นตอน — ถ้าพังจะแปลงเป็น `StepError` ที่ระบุขั้นตอน */
export async function runStep<T>(step: AttendanceStep, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof StepError) throw error;
    throw new StepError(step, errorMessage(error), error);
  }
}
