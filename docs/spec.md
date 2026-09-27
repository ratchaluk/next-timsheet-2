# spec.md — NT Timesheet Auto Attendance

ระบบลงเวลาทำงานออนไลน์อัตโนมัติ ผ่านเว็บ [https://timesheet.ntplc.co.th/](https://timesheet.ntplc.co.th/) โดยรับคำสั่งจาก Telegram และใช้ Playwright ขับเบราว์เซอร์แทนคน

---

## 1. ภาพรวม (Overview)

- โปรแกรมทำงานบน **Next.js** เปิด API endpoint ไว้รับ webhook จาก **Telegram**
- เมื่อได้รับคำสั่ง จะสั่ง **Playwright** ล็อกอินและกดปุ่มลงเวลาบนหน้าเว็บ timesheet แทนผู้ใช้
- รองรับลงเวลาแบบ **ทีละคน** (ระบุลำดับ) หรือ **ทุกคนในลิสต์** (`*`)
- ลงเวลาสำเร็จ → ส่งข้อความยืนยันกลับ Telegram
- ลงเวลาไม่สำเร็จ → ถ่าย screenshot ของหน้าจอ แล้วส่งรูปกลับ Telegram
- Deploy บน **Vercel** ให้ Telegram เรียก webhook ได้โดยตรง

---

## 2. Tech Stack

| ส่วน | เทคโนโลยี |
|------|-----------|
| Framework | Next.js (App Router) + TypeScript |
| Browser automation | Playwright |
| Bot / คำสั่ง | Telegram Bot API |
| Hosting | Vercel |
| Runtime | Node.js |
| Config | `.env` (dotenv) |

> **หมายเหตุ:** Playwright ต้องรันในฝั่ง Node runtime (ไม่ใช่ Edge) — API route ที่เรียก Playwright ต้องตั้ง `export const runtime = "nodejs"`

---

## 3. สถาปัตยกรรม (Architecture)

```
Telegram  ──(webhook)──►  Vercel  ──►  Next.js API route
                                            │
                                            ▼
                                    Command Parser
                              /[user]-[session]-[type]-[place]
                                            │
                                            ▼
                                   Attendance Runner
                          (loop ต่อ user: 1 คน หรือทั้งลิสต์)
                                            │
                                            ▼
                                  Playwright Automation
                         login → scroll → submit → time in/out
                                            │
                            ┌───────────────┴───────────────┐
                            ▼                               ▼
                        สำเร็จ                          ล้มเหลว
                  ส่งข้อความยืนยัน              ถ่าย screenshot + ส่งรูป
                            └───────────────┬───────────────┘
                                            ▼
                                    ส่งผลกลับ Telegram
```

**ลำดับการทำงาน (flow):**
1. Telegram ส่ง update เข้ามาที่ webhook
2. ตรวจสิทธิ์ chat id (อนุญาตเฉพาะที่กำหนดใน env)
3. Parse คำสั่ง → ได้ `{ user, session, type, place }`
4. หา user เป้าหมาย (1 คน จากลำดับ หรือทุกคนเมื่อเป็น `*`)
5. รัน Playwright ต่อ user ทีละคน (sequential เพื่อลดภาระเครื่อง/หลีกเลี่ยง session ชนกัน)
6. รวบรวมผลลัพธ์แล้วส่งกลับ Telegram

---

## 4. รูปแบบคำสั่ง (Command Format)

```
/[user]-[session]-[type]-[place]
```

| ส่วน | ความหมาย | ค่าที่รับได้ |
|------|----------|--------------|
| `user` | ลำดับผู้ใช้ในลิสต์ (ลงทีละคน) หรือทุกคน | `1`, `2`, … หรือ `*` |
| `session` | ลงเข้า / ลงออก | `in` \| `out` |
| `type` | ประเภทการลงเวลา (เลือกจาก dropdown ด้วยข้อความ) | โค้ดตาม mapping เช่น `nm`, `tr` |
| `place` | สถานที่ลงเวลา (กรอกในช่อง textbox) | free text |

**ตัวอย่าง:**
- `/1-in-nm-B9` → ลงเข้า (Time In) ให้ user ลำดับ 1 ประเภท normal ที่ B9
- `/*-in-tr-trainingcenter` → ลงเข้า ให้ **ทุกคน** ประเภท training ที่ trainingcenter

> ⚠️ **จุดที่ต้องยืนยัน:** ในโจทย์ระบุ `nm = normal` แต่ตัวอย่างเขียน `/1-in-nr-B9` (ใช้ `nr`)
> → ต้องเคาะให้ชัดว่าโค้ด normal คือ `nm` หรือ `nr` แล้วกำหนดใน `attendance/types.ts` ให้ตรงกัน

---

## 5. โครงสร้างโปรเจกต์ (Project Structure)

```
timesheet-auto/
├── .env                          # ค่าจริง (gitignore)
├── .env.example                  # ตัวอย่างค่า config
├── .gitignore
├── package.json
├── tsconfig.json
├── next.config.js
├── playwright.config.ts
├── README.md
├── spec.md
│
├── src/
│   ├── app/
│   │   └── api/
│   │       └── telegram/
│   │           └── webhook/
│   │               └── route.ts          # รับ webhook จาก Telegram (runtime = nodejs)
│   │
│   ├── lib/
│   │   ├── telegram/
│   │   │   ├── bot.ts                     # client ส่งข้อความ/รูปกลับ Telegram
│   │   │   ├── command-parser.ts          # parse + validate /[user]-[session]-[type]-[place]
│   │   │   ├── auth.ts                     # ตรวจสิทธิ์ chat id ที่อนุญาต
│   │   │   └── messages.ts                # เทมเพลตข้อความ (ภาษาไทย)
│   │   │
│   │   ├── attendance/
│   │   │   ├── runner.ts                  # orchestrator: วน user แล้วเรียก automation
│   │   │   ├── automation.ts              # เปิด browser/context, จัดการ lifecycle
│   │   │   ├── steps/
│   │   │   │   ├── login.ts               # login → scroll → submit
│   │   │   │   ├── time-in.ts             # กด Time In → เลือก type → กรอก place → ยืนยัน
│   │   │   │   └── time-out.ts            # กด Time Out → เลือก type → กรอก place → ยืนยัน
│   │   │   ├── locators.ts                # TODO: selector ของหน้าเว็บ (เติมภายหลัง)
│   │   │   └── types.ts                   # mapping โค้ด type → ข้อความใน dropdown
│   │   │
│   │   ├── config/
│   │   │   ├── env.ts                     # โหลด + validate env
│   │   │   └── users.ts                   # โหลดลิสต์ผู้ใช้จาก env
│   │   │
│   │   └── utils/
│   │       ├── screenshot.ts              # ถ่าย screenshot ตอนล้มเหลว (ในหน่วยความจำ)
│   │       └── logger.ts
│   │
│   └── types/
│       └── index.ts                       # shared types (Command, UserAccount, Result…)
│
└── scripts/
    └── set-webhook.ts                     # ลงทะเบียน webhook URL (PUBLIC_URL) กับ Telegram
```

---

## 6. Environment Variables (`.env`)

```bash
# ── เว็บ timesheet ──
TIMESHEET_URL=https://timesheet.ntplc.co.th/

# ── Telegram ──
TELEGRAM_BOT_TOKEN=xxxxxxxx:yyyyyyyyyyyyyyyyyyyy
TELEGRAM_ALLOWED_CHAT_IDS=123456789,987654321   # คั่นด้วย comma; รับคำสั่งเฉพาะ chat เหล่านี้

# ── รายชื่อผู้ใช้ (เรียงตามลำดับ user 1,2,3…) ──
# ลำดับใน command อ้างถึงเลขนี้
USER_1_NAME=สมชาย
USER_1_USERNAME=somchai
USER_1_PASSWORD=secret1

USER_2_NAME=สมหญิง
USER_2_USERNAME=somying
USER_2_PASSWORD=secret2
# … เพิ่มได้ตามจำนวนคนในลิสต์

# ── Playwright ──
HEADLESS=true            # true = ไม่เปิดหน้าต่างเบราว์เซอร์
NAV_TIMEOUT_MS=30000

# ── Server ──
PORT=3000
PUBLIC_URL=             # URL ที่ deploy แล้ว เช่น https://xxxx.vercel.app
```

> รูปแบบ `USER_n_*` โหลดผ่าน `config/users.ts` เป็น array — index ใน command (`1`, `2`, …) แมปตรงกับเลข `n`
> ทางเลือก: ถ้าคนเยอะ อาจย้ายไปเก็บเป็น `USERS_JSON` (JSON array) แทนก็ได้

---

## 7. ขั้นตอนการลงเวลา (Attendance Process)

### 7.1 Login (ทุกครั้งก่อนลงเวลา)
1. เปิด `TIMESHEET_URL`
2. กรอก **username** และ **password**
3. **scroll ลง** ในหน้าต่างที่แสดง
4. คลิกปุ่ม **submit**

### 7.2 ช่วงเช้า — Time In
1. คลิกปุ่ม **"Time In"**
2. เลือก **ประเภทการลงเวลา** จาก dropdown (แมปจากโค้ด `type`)
3. กรอก **สถานที่** ลงใน textbox (ค่า `place`)
4. คลิกปุ่ม **"Time In"** เพื่อยืนยัน

### 7.3 ช่วงเย็น — Time Out
1. คลิกปุ่ม **"Time Out"**
2. เลือก **ประเภทการลงเวลา** จาก dropdown (แมปจากโค้ด `type`)
3. กรอก **สถานที่** ลงใน textbox (ค่า `place`)
4. คลิกปุ่ม **"Time Out"** เพื่อยืนยัน

> `session=in` → เรียก flow 7.2, `session=out` → เรียก flow 7.3
> Locators ของแต่ละปุ่ม/dropdown/textbox ยังไม่กำหนด → รวมไว้ที่ `attendance/locators.ts`

---

## 8. Type Mapping (โค้ด → ข้อความใน dropdown)

กำหนดที่ `src/lib/attendance/types.ts` — ค่า label ต้อง **ตรงกับข้อความจริงใน dropdown** ของหน้าเว็บ (เติมภายหลัง)

```ts
// TODO: แก้ label ให้ตรงกับข้อความจริงใน dropdown
export const ATTENDANCE_TYPE_MAP: Record<string, string> = {
  nm: "ปกติ",       // normal   (ยืนยันโค้ด nm/nr อีกที)
  tr: "อบรม",       // training
  // เพิ่มประเภทอื่น ๆ ที่นี่
};
```

---

## 9. การจัดการผลลัพธ์ (Result Handling)

| กรณี | การตอบกลับ Telegram |
|------|---------------------|
| สำเร็จ (1 คน) | ข้อความ: `✅ {ชื่อ} ลงเวลา{เข้า/ออก}สำเร็จ` |
| สำเร็จ (`*` ทุกคน) | สรุปรายคน เช่น `✅ สมชาย สำเร็จ` / `✅ สมหญิง สำเร็จ` ครบทุกคน |
| ล้มเหลว | ถ่าย **screenshot** หน้าจอ ณ จุดที่ error → ส่งเป็นรูปกลับ พร้อมข้อความสั้น ๆ ว่าใครล้มเหลวที่ขั้นตอนไหน |

- โหมด `*` รันทีละคนต่อเนื่อง และรวมผลของทุกคนก่อนสรุปกลับ (คนที่พลาดไม่ทำให้คนอื่นหยุด)
- screenshot เก็บในหน่วยความจำแล้วส่งตรงไป Telegram — ไม่บันทึกลงดิสก์

---

## 10. ความปลอดภัย / ข้อควรระวัง

- รับ webhook เฉพาะ `TELEGRAM_ALLOWED_CHAT_IDS` เท่านั้น — คำสั่งจาก chat อื่นให้ปฏิเสธ
- รหัสผ่านและ URL อยู่ใน `.env` เท่านั้น (อย่า commit) — `.gitignore` ครอบ `.env`
- Playwright รันในโหมด `nodejs` runtime; ตั้ง timeout กัน hang
- แนะนำเก็บ log การลงเวลา (ใคร/เมื่อไหร่/ผลลัพธ์) ไว้ตรวจสอบย้อนหลัง

---

## 11. การรัน (Vercel)

```bash
# 1) ติดตั้ง
npm install
npx playwright install chromium

# 2) รัน Next.js (ทดสอบในเครื่อง)
npm run dev            # ที่ PORT=3000

# 3) Deploy ขึ้น Vercel แล้วนำ URL ที่ได้ไปใส่ PUBLIC_URL ใน .env

# 4) ลงทะเบียน webhook กับ Telegram
npm run set-webhook    # เรียก scripts/set-webhook.ts ใช้ PUBLIC_URL + BOT_TOKEN
```

---

## 12. สิ่งที่ต้องเติมภายหลัง (TODO)

- [ ] **Locators** ทั้งหมดใน `attendance/locators.ts` (ปุ่ม submit, Time In, Time Out, dropdown, textbox)
- [ ] ยืนยันโค้ดประเภท normal: `nm` หรือ `nr`
- [ ] เติม label จริงของ dropdown ใน `ATTENDANCE_TYPE_MAP`
- [ ] ตรวจว่าหน้าเว็บมี popup / iframe / OTP หรือขั้นตอนพิเศษก่อนลงเวลาหรือไม่
- [ ] รูปแบบข้อความ success/fail ที่ต้องการให้ตอบกลับ
