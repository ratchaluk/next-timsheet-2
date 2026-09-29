/**
 * mapping โค้ดประเภทการลงเวลา → ข้อความที่ต้องเลือกใน dropdown
 *
 * ⚠️ TODO: label ด้านล่างเป็นค่าคาดเดา ต้องแก้ให้ **ตรงกับข้อความจริง** ใน dropdown
 * ของหน้าเว็บ timesheet (ตัวพิมพ์/เว้นวรรคต้องตรง) ไม่งั้นขั้นตอน select-type จะล้มเหลว
 */

/** โค้ด → ข้อความใน dropdown */
export const ATTENDANCE_TYPE_MAP: Record<string, string> = {
  nm: "เข้า-ออกงานปกติ", // normal
  tr: "ฝึกอบรม", // training
  // เพิ่มประเภทอื่น ๆ ที่นี่ เช่น
  // ot: "ทำงานล่วงเวลา",
  wfh: "WFH",
};

/**
 * โค้ดพ้องความหมาย → โค้ดหลัก
 *
 * spec ระบุ `nm = normal` แต่ตัวอย่างในโจทย์เขียน `/1-in-nr-B9` (ใช้ `nr`)
 * จึงรับทั้งสองแบบไปก่อน เพื่อให้พิมพ์แบบไหนก็ใช้งานได้
 * ถ้าภายหลังเคาะได้ว่าใช้โค้ดไหนแน่ ให้ลบอีกตัวออกจากตรงนี้
 */
export const TYPE_ALIASES: Record<string, string> = {
  nr: "nm",
};

export class UnknownTypeError extends Error {
  constructor(public readonly code: string) {
    super(`ไม่รู้จักประเภทการลงเวลา "${code}"`);
    this.name = "UnknownTypeError";
  }
}

/** normalize โค้ด (lowercase + แปลง alias) แล้วคืนโค้ดหลัก */
export function normalizeTypeCode(input: string): string {
  const code = input.trim().toLowerCase();
  return TYPE_ALIASES[code] ?? code;
}

/** แปลงโค้ดเป็นข้อความใน dropdown — throw `UnknownTypeError` ถ้าไม่รู้จัก */
export function resolveTypeLabel(input: string): { code: string; label: string } {
  const code = normalizeTypeCode(input);
  const label = ATTENDANCE_TYPE_MAP[code];
  if (!label) {
    throw new UnknownTypeError(input.trim().toLowerCase());
  }
  return { code, label };
}

/** รายการโค้ดที่ใช้ได้ (รวม alias) ไว้แสดงในข้อความช่วยเหลือ */
export function listTypeCodes(): string[] {
  const canonical = Object.keys(ATTENDANCE_TYPE_MAP);
  const aliases = Object.keys(TYPE_ALIASES).filter((alias) =>
    canonical.includes(TYPE_ALIASES[alias]),
  );
  return [...canonical, ...aliases];
}
