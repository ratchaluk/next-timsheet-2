/**
 * โหลดลิสต์ผู้ใช้จาก env
 *
 * รองรับ 2 รูปแบบ:
 *   1. `USER_n_NAME` / `USER_n_USERNAME` / `USER_n_PASSWORD`  (ค่าเริ่มต้น)
 *   2. `USERS_JSON` — JSON array `[{ "name": "...", "username": "...", "password": "..." }]`
 *      ใช้เมื่อมีคนเยอะจนเขียนแบบแรกไม่ไหว; ลำดับใน array = ลำดับในคำสั่ง (เริ่มที่ 1)
 *
 * เลขลำดับที่ใช้ในคำสั่ง `/[user]-...` แมปตรงกับ `index` ของผู้ใช้
 */

import type { UserAccount } from "@/types";
import { EnvError } from "./env";

const USER_KEY_PATTERN = /^USER_(\d+)_USERNAME$/;

function fromJson(raw: string): UserAccount[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new EnvError("ค่า USERS_JSON ไม่ใช่ JSON ที่ถูกต้อง");
  }

  if (!Array.isArray(parsed)) {
    throw new EnvError("ค่า USERS_JSON ต้องเป็น JSON array");
  }

  return parsed.map((entry, position) => {
    const index = position + 1;
    if (typeof entry !== "object" || entry === null) {
      throw new EnvError(`USERS_JSON ลำดับที่ ${index} ไม่ใช่ object`);
    }

    const record = entry as Record<string, unknown>;
    const username = record.username;
    const password = record.password;
    const name = record.name;

    if (typeof username !== "string" || !username.trim()) {
      throw new EnvError(`USERS_JSON ลำดับที่ ${index} ไม่มี username`);
    }
    if (typeof password !== "string" || !password) {
      throw new EnvError(`USERS_JSON ลำดับที่ ${index} ไม่มี password`);
    }

    return {
      index,
      name: typeof name === "string" && name.trim() ? name.trim() : username.trim(),
      username: username.trim(),
      password,
    };
  });
}

function fromNumberedKeys(): UserAccount[] {
  const indexes = Object.keys(process.env)
    .map((key) => USER_KEY_PATTERN.exec(key))
    .filter((match): match is RegExpExecArray => match !== null)
    .map((match) => Number(match[1]))
    .sort((a, b) => a - b);

  return indexes.map((index) => {
    const username = process.env[`USER_${index}_USERNAME`]?.trim();
    const password = process.env[`USER_${index}_PASSWORD`];
    const name = process.env[`USER_${index}_NAME`]?.trim();

    if (!username) {
      throw new EnvError(`ไม่พบค่า USER_${index}_USERNAME`);
    }
    if (!password) {
      throw new EnvError(`ไม่พบค่า USER_${index}_PASSWORD (ของ ${username})`);
    }

    return { index, name: name || username, username, password };
  });
}

/** โหลดผู้ใช้ทั้งหมด เรียงตามลำดับ — throw `EnvError` ถ้าไม่มีใครเลย */
export function loadUsers(): UserAccount[] {
  const json = process.env.USERS_JSON?.trim();
  const users = json ? fromJson(json) : fromNumberedKeys();

  if (users.length === 0) {
    throw new EnvError(
      "ไม่พบรายชื่อผู้ใช้ใน .env — ตั้งค่า USER_1_USERNAME / USER_1_PASSWORD หรือ USERS_JSON",
    );
  }
  return users;
}

/**
 * เลือกผู้ใช้เป้าหมายตามคำสั่ง
 * `*` = ทุกคน, ตัวเลข = คนที่ลำดับนั้น
 */
export function selectUsers(users: UserAccount[], selector: number | "*"): UserAccount[] {
  if (selector === "*") return users;

  const match = users.find((user) => user.index === selector);
  if (!match) {
    const available = users.map((user) => user.index).join(", ");
    throw new EnvError(`ไม่พบผู้ใช้ลำดับที่ ${selector} (มีลำดับ: ${available})`);
  }
  return [match];
}
