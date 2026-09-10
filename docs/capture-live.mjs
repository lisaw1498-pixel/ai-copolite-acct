import { chromium } from "playwright";

const BASE = "http://localhost:3100";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();

await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.waitForTimeout(4000);
await page.fill('input[type=email]', "test@example.com");
await page.fill('input[type=password]', "testpassword123");
await page.getByRole("button", { name: /continue with email/i }).click();
await page.waitForURL(/dashboard/, { timeout: 45000 });

// Fresh live session against the real Northshore job.
const sid = await page.evaluate(async () => {
  const jobs = await (await fetch("/api/jobs")).json();
  const job = jobs.jobs.find((j) => j.company === "Northshore Medical Group");
  const s = await (await fetch("/api/sessions", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionType: "live", jobId: job.id, config: { responseLength: "standard" } }),
  })).json();
  return s.session.id;
});
console.log("live session", sid);

await page.goto(`${BASE}/live/session/${sid}`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3000);
await page.fill("textarea", "Tell me about a time you had to manage competing project priorities.");
await page.keyboard.down("Control");
await page.keyboard.press("Enter");
await page.keyboard.up("Control");

// Wait for the grounding badge, which only renders once validation has run.
try {
  await page.waitForSelector("text=Answer Grounded in Your Experience", { timeout: 90000 });
  await page.waitForTimeout(1500);
  console.log("answer complete");
} catch {
  console.log("badge never appeared - capturing whatever is there");
}
await page.screenshot({ path: "docs/img/13-live-copilot.png" });
await browser.close();
console.log("recaptured live copilot");
