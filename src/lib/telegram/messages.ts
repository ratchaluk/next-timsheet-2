/** เทมเพลตข้อความภาษาไทยที่ตอบกลับ Telegram */

import type { AttendanceResult, Command, Session, UserAccount } from "@/types";
import { STEP_LABELS } from "@/types";
import { listTypeCodes } from "../attendance/types";

function sessionLabel(session: Session): string {
  return session === "in" ? "เข้า" : "ออก";
}

/** ข้อความแจ้งว่ารับคำสั่งแล้ว กำลังทำงาน */
export function acknowledged(command: Command, targets: UserAccount[]): string {
  const who =
    command.selector === "*"
      ? `ทุกคน (${targets.length} คน)`
      : `${targets[0].name} (ลำดับ ${targets[0].index})`;

  return [
    `⏳ กำลังลงเวลา${sessionLabel(command.session)}...`,
    `• ผู้ใช้: ${who}`,
    `• ประเภท: ${command.typeLabel} (${command.typeCode})`,
    `• สถานที่: ${command.place}`,
  ].join("\n");
}

/** ข้อความสำเร็จของผู้ใช้ 1 คน */
export function successLine(result: AttendanceResult): string {
  return `✅ ${result.user.name} ลงเวลา${sessionLabel(result.session)}สำเร็จ`;
}

/** ข้อความล้มเหลวของผู้ใช้ 1 คน (ใช้เป็น caption ของ screenshot ด้วย) */
export function failureLine(result: AttendanceResult): string {
  const step = result.failedStep ? STEP_LABELS[result.failedStep] : "ไม่ทราบขั้นตอน";
  const detail = result.error ? `\n   ${result.error}` : "";
  return `❌ ${result.user.name} ลงเวลา${sessionLabel(result.session)}ไม่สำเร็จ (ขั้นตอน: ${step})${detail}`;
}

/** สรุปผลรวมทุกคน */
export function summary(results: AttendanceResult[]): string {
  const succeeded = results.filter((result) => result.ok).length;
  const failed = results.length - succeeded;

  const lines = results.map((result) => (result.ok ? successLine(result) : failureLine(result)));

  if (results.length > 1) {
    lines.push("", `สรุป: สำเร็จ ${succeeded} คน, ล้มเหลว ${failed} คน`);
  }
  return lines.join("\n");
}

/** ข้อความเมื่อคำสั่งผิดรูปแบบ */
export function invalidCommand(error: string): string {
  return [`⚠️ ${error}`, "", usage()].join("\n");
}

/** ข้อความเมื่อเกิดข้อผิดพลาดที่ไม่คาดคิด */
export function unexpectedError(message: string): string {
  return `💥 เกิดข้อผิดพลาด: ${message}`;
}

/** ข้อความเมื่อมีงานค้างอยู่ */
export function busy(): string {
  return "⏳ มีคำสั่งลงเวลากำลังทำงานอยู่ กรุณารอให้เสร็จก่อนแล้วสั่งใหม่อีกครั้ง";
}

/** คู่มือการใช้งาน */
export function usage(): string {
  return [
    "📖 วิธีใช้",
    "`/[user]-[session]-[type]-[place]`",
    "",
    "• user — ลำดับผู้ใช้ (1, 2, …) หรือ `*` = ทุกคน",
    "• session — `in` (ลงเข้า) หรือ `out` (ลงออก)",
    `• type — ${listTypeCodes().join(", ")}`,
    "• place — สถานที่ (พิมพ์อิสระ)",
    "",
    "ตัวอย่าง:",
    "`/1-in-nm-B9` — ลงเข้าให้คนที่ 1 ประเภทปกติ ที่ B9",
    "`/*-in-tr-trainingcenter` — ลงเข้าให้ทุกคน ประเภทอบรม",
    "",
    "คำสั่งอื่น: `/users` ดูรายชื่อผู้ใช้, `/help` ดูคู่มือนี้",
  ].join("\n");
}

/** รายชื่อผู้ใช้ที่ตั้งค่าไว้ (ไม่แสดงรหัสผ่าน) */
export function userList(users: UserAccount[]): string {
  const lines = users.map((user) => `${user.index}. ${user.name} (${user.username})`);
  return ["👥 รายชื่อผู้ใช้ที่ตั้งค่าไว้", ...lines].join("\n");
}
