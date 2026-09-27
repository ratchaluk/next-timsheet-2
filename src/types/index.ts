/** ประเภทข้อมูลที่ใช้ร่วมกันทั้งโปรเจกต์ */

/** ลงเข้า (`in`) หรือ ลงออก (`out`) */
export type Session = "in" | "out";

/** ลำดับผู้ใช้ในลิสต์ หรือ `*` = ทุกคน */
export type UserSelector = number | "*";

/** คำสั่งที่ parse แล้วจากข้อความ Telegram */
export interface Command {
  /** ลำดับผู้ใช้ (1, 2, …) หรือ `*` */
  selector: UserSelector;
  session: Session;
  /** โค้ดประเภทหลัง normalize (เช่น `nr` → `nm`) */
  typeCode: string;
  /** ข้อความที่ต้องเลือกใน dropdown */
  typeLabel: string;
  /** สถานที่ที่กรอกลง textbox */
  place: string;
  /** ข้อความดิบที่ผู้ใช้พิมพ์มา (ไว้ใส่ใน log) */
  raw: string;
}

/** บัญชีผู้ใช้ 1 คนที่โหลดมาจาก env */
export interface UserAccount {
  /** เลข `n` ใน `USER_n_*` — ตรงกับลำดับที่ใช้ในคำสั่ง */
  index: number;
  name: string;
  username: string;
  password: string;
}

/** ขั้นตอนย่อยของการลงเวลา ใช้บอกว่าพังตรงไหน */
export type AttendanceStep =
  | "launch"
  | "login"
  | "open-dialog"
  | "select-type"
  | "fill-place"
  | "confirm";

/** ป้ายชื่อภาษาไทยของแต่ละขั้นตอน ใช้ในข้อความแจ้งเตือน */
export const STEP_LABELS: Record<AttendanceStep, string> = {
  launch: "เปิดเบราว์เซอร์",
  login: "เข้าสู่ระบบ",
  "open-dialog": "เปิดหน้าลงเวลา",
  "select-type": "เลือกประเภทการลงเวลา",
  "fill-place": "กรอกสถานที่",
  confirm: "ยืนยันการลงเวลา",
};

/** ผลการลงเวลาของผู้ใช้ 1 คน */
export interface AttendanceResult {
  user: UserAccount;
  session: Session;
  ok: boolean;
  /** ขั้นตอนที่ล้มเหลว (มีเฉพาะตอน `ok === false`) */
  failedStep?: AttendanceStep;
  error?: string;
  /** รูป screenshot (PNG) ที่ถ่ายไว้ตอนล้มเหลว — อยู่ในหน่วยความจำ ไม่ได้บันทึกลงดิสก์ */
  screenshot?: Buffer;
  /** เวลาที่ใช้ทั้งหมด (ms) */
  durationMs: number;
}
