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

await page.evaluate(() => {
  try { localStorage.setItem("theme", "dark"); } catch {}
  document.documentElement.dataset.theme = "dark";
});
await page.waitForTimeout(2500);
await page.screenshot({ path: "docs/img/16-dark-mode.png" });
console.log("captured 16-dark-mode");

// Leave the account back on light so the app is not unexpectedly dark next visit.
await page.evaluate(() => {
  try { localStorage.setItem("theme", "light"); } catch {}
  document.documentElement.dataset.theme = "light";
});
await browser.close();
