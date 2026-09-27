/** หน้าสถานะ — ไว้เช็คว่าเซิร์ฟเวอร์รันอยู่ ตัวระบบจริงทำงานผ่าน Telegram webhook */

const COMMANDS = [
  { command: "/1-in-nm-B9", description: "ลงเข้าให้คนที่ 1 ประเภทปกติ ที่ B9" },
  { command: "/*-in-tr-trainingcenter", description: "ลงเข้าให้ทุกคน ประเภทอบรม" },
  { command: "/2-out-nm-B9", description: "ลงออกให้คนที่ 2 ประเภทปกติ ที่ B9" },
  { command: "/help", description: "ดูคู่มือการใช้งานในแชท" },
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-8 px-6 py-16">
      <header className="flex flex-col gap-2">
        <span className="inline-flex w-fit items-center gap-2 rounded-full bg-green-500/10 px-3 py-1 text-sm font-medium text-green-700 dark:text-green-400">
          <span className="size-2 rounded-full bg-green-500" />
          เซิร์ฟเวอร์ทำงานอยู่
        </span>
        <h1 className="text-2xl font-semibold tracking-tight">NT Timesheet Auto Attendance</h1>
        <p className="text-sm text-black/60 dark:text-white/60">
          ระบบลงเวลาอัตโนมัติ สั่งงานผ่าน Telegram — หน้านี้มีไว้เช็คสถานะเท่านั้น
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">ตัวอย่างคำสั่ง</h2>
        <ul className="flex flex-col gap-2">
          {COMMANDS.map(({ command, description }) => (
            <li
              key={command}
              className="flex flex-col gap-1 rounded-lg border border-black/10 p-3 dark:border-white/15"
            >
              <code className="font-mono text-sm">{command}</code>
              <span className="text-xs text-black/60 dark:text-white/60">{description}</span>
            </li>
          ))}
        </ul>
      </section>

      <footer className="text-xs text-black/50 dark:text-white/50">
        Webhook endpoint: <code className="font-mono">/api/telegram/webhook</code>
      </footer>
    </main>
  );
}
