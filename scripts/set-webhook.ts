/**
 * ลงทะเบียน webhook URL (PUBLIC_URL) กับ Telegram
 *
 *   npm run set-webhook            # ตั้ง webhook ตาม PUBLIC_URL ใน .env
 *   npm run set-webhook -- --info  # ดูสถานะ webhook ปัจจุบัน
 *   npm run set-webhook -- --delete # ยกเลิก webhook
 */

import "dotenv/config";

const WEBHOOK_PATH = "/api/telegram/webhook";

function token(): string {
  const value = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!value) {
    console.error("❌ ไม่พบ TELEGRAM_BOT_TOKEN ใน .env");
    process.exit(1);
  }
  return value;
}

async function callApi(method: string, body?: unknown): Promise<unknown> {
  const response = await fetch(`https://api.telegram.org/bot${token()}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });

  const payload = (await response.json()) as { ok: boolean; description?: string; result?: unknown };
  if (!payload.ok) {
    console.error(`❌ ${method} ล้มเหลว: ${payload.description ?? response.statusText}`);
    process.exit(1);
  }
  return payload.result;
}

async function showInfo(): Promise<void> {
  const info = await callApi("getWebhookInfo");
  console.log("ℹ️  สถานะ webhook ปัจจุบัน:");
  console.log(JSON.stringify(info, null, 2));
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes("--info")) {
    await showInfo();
    return;
  }

  if (args.includes("--delete")) {
    await callApi("deleteWebhook", { drop_pending_updates: true });
    console.log("✅ ยกเลิก webhook แล้ว");
    return;
  }

  const publicUrl = process.env.PUBLIC_URL?.trim() ||
    `https://${process.env.VERCEL_URL}`;
  const webhookUrl = `${publicUrl}/api/webhook`;
  if (!webhookUrl) {
    console.error("❌ ไม่พบ PUBLIC_URL ใน .env — ใส่ URL ที่ deploy แล้วก่อน");
    console.error('   ตัวอย่าง: PUBLIC_URL=https://xxxx.vercel.app');
    process.exit(1);
  }

  const url = `${webhookUrl.replace(/\/+$/, "")}${WEBHOOK_PATH}`;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();

  await callApi("setWebhook", {
    url,
    allowed_updates: ["message"],
    drop_pending_updates: true,
    ...(secret ? { secret_token: secret } : {}),
  });

  console.log(`✅ ตั้ง webhook เรียบร้อย: ${url}`);
  if (!secret) {
    console.log("⚠️  ยังไม่ได้ตั้ง TELEGRAM_WEBHOOK_SECRET — แนะนำให้ตั้งเพื่อความปลอดภัย");
  }
  await showInfo();
}

main().catch((error: unknown) => {
  console.error("❌ เกิดข้อผิดพลาด:", error instanceof Error ? error.message : error);
  process.exit(1);
});
