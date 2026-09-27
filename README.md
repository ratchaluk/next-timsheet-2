# NT Timesheet Auto Attendance

ระบบลงเวลาทำงานออนไลน์อัตโนมัติบน [timesheet.ntplc.co.th](https://timesheet.ntplc.co.th/)
สั่งงานผ่าน Telegram แล้วให้ Playwright ขับเบราว์เซอร์กดลงเวลาแทน

รายละเอียดข้อกำหนดทั้งหมดอยู่ที่ [docs/spec.md](docs/spec.md)

---

## เริ่มใช้งาน

```bash
# 1) ติดตั้ง
npm install
npx playwright install chromium

# 2) ตั้งค่า
cp .env.example .env     # แล้วแก้ค่าใน .env ให้ครบ

# 3) รัน
npm run dev              # http://localhost:3000

# 4) Deploy ขึ้น Vercel แล้วเอา URL ที่ได้ไปใส่ PUBLIC_URL ใน .env

# 5) ลงทะเบียน webhook กับ Telegram
npm run set-webhook
```

คำสั่งอื่นของ `set-webhook`:

```bash
npm run set-webhook -- --info     # ดูสถานะ webhook ปัจจุบัน
npm run set-webhook -- --delete   # ยกเลิก webhook
```

---

## คำสั่งใน Telegram

```
/[user]-[session]-[type]-[place]
```

| ส่วน | ความหมาย | ค่าที่รับได้ |
|------|----------|--------------|
| `user` | ลำดับผู้ใช้ใน `.env` หรือทุกคน | `1`, `2`, … หรือ `*` |
| `session` | ลงเข้า / ลงออก | `in` \| `out` |
| `type` | ประเภทการลงเวลา | `nm` (ปกติ), `tr` (อบรม) |
| `place` | สถานที่ (พิมพ์อิสระ มี `-` หรือเว้นวรรคได้) | เช่น `B9` |

**ตัวอย่าง**

| คำสั่ง | ผล |
|--------|-----|
| `/1-in-nm-B9` | ลงเข้าให้คนที่ 1 ประเภทปกติ ที่ B9 |
| `/*-in-tr-trainingcenter` | ลงเข้าให้ **ทุกคน** ประเภทอบรม |
| `/2-out-nm-B9` | ลงออกให้คนที่ 2 |

คำสั่งเสริม: `/help` ดูคู่มือ · `/users` ดูรายชื่อผู้ใช้ที่ตั้งค่าไว้

> `nr` ใช้แทน `nm` ได้ (spec ยังไม่เคาะว่าโค้ด normal คือตัวไหน จึงรับทั้งคู่ไว้ก่อน —
> ดู `TYPE_ALIASES` ใน [src/lib/attendance/types.ts](src/lib/attendance/types.ts))

**ผลลัพธ์**

- สำเร็จ → ข้อความยืนยันกลับ Telegram
- ล้มเหลว → ถ่าย screenshot แล้วส่งรูปกลับพร้อมบอกว่าพังขั้นตอนไหน (ไม่บันทึกลงดิสก์)
- โหมด `*` รันทีละคนตามลำดับ คนที่พลาดไม่ทำให้คนอื่นหยุด

---

## โครงสร้างโค้ด

```
src/
├── app/api/telegram/webhook/route.ts   รับ webhook (runtime = nodejs)
├── lib/
│   ├── telegram/       bot, command-parser, auth, messages
│   ├── attendance/     runner, automation, locators, types, steps/
│   ├── config/         env, users
│   └── utils/          screenshot, logger
└── types/              shared types
scripts/set-webhook.ts  ลงทะเบียน webhook URL กับ Telegram
```

**คำสั่งที่ใช้บ่อย**

```bash
npm run dev              # dev server
npm run build            # production build
npm run typecheck        # ตรวจ type
npm run lint             # ESLint
npm run attend           # รันลงเวลาจาก command line (ดูหัวข้อถัดไป)
npm run check-selectors  # ตรวจว่า selector ตัวไหนใช้ได้จริง
npm run set-webhook      # ลงทะเบียน webhook กับ Telegram
```

---

## รันด้วย Playwright ตรง ๆ (ไม่ผ่าน Telegram)

ตอนพัฒนา/หา selector ไม่ต้อง deploy หรือตั้ง webhook — สั่งจาก command line ได้เลย
ใช้ code ชุดเดียวกับที่บอทเรียก ผลลัพธ์จึงตรงกัน

```bash
npm run attend -- "/1-in-nm-B9"                  # รันแบบไม่เปิดหน้าต่าง
npm run attend -- "/1-in-nm-B9" --headed         # เปิดหน้าต่างให้ดู
npm run attend -- "/1-in-nm-B9" --headed --slow=300   # ช้าลง ดูง่าย
npm run attend -- "/1-in-nm-B9" --debug          # Playwright Inspector หยุดทีละ step
npm run attend -- "/*-out-nm-B9"                 # ทุกคน
```

> ใส่ quote รอบคำสั่งเสมอ ไม่งั้น shell จะตีความ `*` เอง
> exit code = 0 เมื่อสำเร็จทุกคน, 1 เมื่อมีคนล้มเหลว

**ตรวจว่า selector ตัวไหนใช้ได้จริง** — เครื่องมือนี้จะบอกว่าแต่ละองค์ประกอบเจอไหม
เจอด้วย candidate ตัวที่เท่าไหร่ และ element หน้าตาเป็นยังไง

```bash
npm run check-selectors                               # ตรวจเฉพาะหน้า login
npm run check-selectors -- --user=1                   # login แล้วตรวจต่อ
npm run check-selectors -- --user=1 --open-dialog     # เปิดหน้าต่างลงเวลาแล้วตรวจต่อ
```

โหมด `--open-dialog` จะ **พ่นรายการ option ทั้งหมดใน dropdown** ออกมาให้เอาไปใส่
`ATTENDANCE_TYPE_MAP` ได้ตรง ๆ และจะ *ไม่กดปุ่มยืนยัน* จึงไม่มีการลงเวลาจริงเกิดขึ้น

ตัวอย่างผลลัพธ์:

```
── หน้า login ──
  ✅ usernameInput          candidate #1
     ช่องกรอก username: <input id="username" name="username" type="text">
  ❌ placeInput             ไม่เจอ — ช่องกรอกสถานที่

  📋 option ใน dropdown (4 รายการ) — เอาไปใส่ ATTENDANCE_TYPE_MAP:
     value="1"  label="ปกติ"
     value="2"  label="อบรม"
```

---

## ⚠️ ก่อนใช้งานจริง ต้องแก้ selector ก่อน

ตอนเขียนยังไม่มีสิทธิ์เข้าหน้าเว็บจริง **selector ทั้งหมดใน
[src/lib/attendance/locators.ts](src/lib/attendance/locators.ts) จึงเป็นค่าคาดเดา**
และ label ใน [src/lib/attendance/types.ts](src/lib/attendance/types.ts) ก็ยังไม่ยืนยัน

แต่ละองค์ประกอบเก็บเป็น **ลิสต์ candidate เรียงตามลำดับความมั่นใจ** ระบบจะไล่ลองทีละตัว
(ทั้งหน้าหลักและทุก iframe) จนเจอตัวที่มองเห็นได้จริง — เดาผิดบางตัวจึงยังพอทำงานได้

**วิธีแก้ให้ตรงกับหน้าเว็บจริง**

1. `npm run check-selectors -- --user=1 --open-dialog` — ดูว่าตัวไหน ❌ และ dropdown มี option อะไรบ้าง
2. ตัวที่ ❌ ให้เปิด DevTools หา selector จริงที่หน้าเว็บ
   (หรือ `npm run attend -- "/1-in-nm-B9" --headed --slow=300` เพื่อดูว่าติดตรงไหน)
3. เติม candidate ตัวจริงไว้ **บนสุด** ของลิสต์นั้น เช่น

   ```ts
   usernameInput: defineLocator(
     "ช่องกรอก username",
     (s) => s.locator("#txtUsername"),   // ← เติมตัวจริงไว้บนสุด
     ...
   ),
   ```

4. แก้ `ATTENDANCE_TYPE_MAP` ให้ label ตรงกับข้อความจริงใน dropdown

**ที่ยังเหลือให้ยืนยัน** (spec ข้อ 12)

- [ ] selector จริงทั้งหมดใน `locators.ts`
- [ ] label จริงของ dropdown ใน `ATTENDANCE_TYPE_MAP`
- [ ] โค้ด normal คือ `nm` หรือ `nr` (ตอนนี้รับทั้งคู่)
- [ ] หน้าเว็บมี popup / OTP / ขั้นตอนพิเศษก่อนลงเวลาหรือไม่

---

## ความปลอดภัย

- รับคำสั่งเฉพาะ chat id ใน `TELEGRAM_ALLOWED_CHAT_IDS`
- ตั้ง `TELEGRAM_WEBHOOK_SECRET` ไว้ด้วย เพื่อกันคนยิง webhook ตรง ๆ
- รหัสผ่านอยู่ใน `.env` เท่านั้น — `.env` ถูก gitignore แล้ว
- screenshot อาจติดข้อมูลส่วนตัวบนหน้าจอ ระวังตอนแชร์
