import { chromium } from "playwright";
import fs from "fs";

const BASE = "http://localhost:3100";
const OUT = "docs/img";
fs.mkdirSync(OUT, { recursive: true });

const JOB = "422b2c04-39f3-44e8-bfca-aac9b489518b";
const QUESTION = "20c0f8a5-958f-4c45-a382-5b778468bc04";
const MOCK = "d74ff485-5563-4725-9a4a-33c2ca47cb63";
const LIVE = "edd29337-b619-41e1-b644-2a1f8b1b29be";
const REPORT = "852d727a-eb31-4aac-81b8-7eea35922371";

const SHOTS = [
  ["01-dashboard", "/dashboard", 3000],
  ["02-resume-manager", "/profile/resume", 3000],
  ["03-verified-experience", "/profile/verified-experience", 3500],
  ["04-career-stories", "/profile/career-stories", 3000],
  ["05-skills-tools", "/profile/skills", 3000],
  ["06-job-opportunities", "/jobs", 3000],
  ["07-job-analysis", `/jobs/${JOB}`, 4000],
  ["08-question-library", "/prepare/questions", 4000],
  ["09-answer-preparation", `/prepare/${JOB}/answers/${QUESTION}`, 6000],
  ["10-mock-setup", "/practice", 3000],
  ["11-mock-session", `/practice/session/${MOCK}`, 20000],
  ["12-live-launch", "/live", 4000],
  ["14-post-interview-report", `/history/${REPORT}`, 5000],
  ["15-interview-history", "/history", 3000],
];

const browser = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  permissions: [],
});
const page = await ctx.newPage();

// Sign in.
await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
// Wait for React to hydrate. Submitting before the handler is attached makes
// the browser do a plain form GET and the sign-in never happens.
await page.waitForTimeout(4000);
await page.fill('input[type=email]', "test@example.com");
await page.fill('input[type=password]', "testpassword123");
await page.getByRole("button", { name: /continue with email/i }).click();
await page.waitForURL(/dashboard|onboarding/, { timeout: 45000 });
await page.waitForTimeout(2000);
console.log("signed in ->", page.url());

for (const [name, path, wait] of SHOTS) {
  try {
    await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(wait);
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
    console.log("captured", name);
  } catch (e) {
    console.log("FAILED", name, String(e).slice(0, 90));
  }
}

// Live copilot: ask a real question so the panels are populated rather than empty.
try {
  await page.goto(`${BASE}/live/session/${LIVE}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  const ta = await page.$("textarea");
  if (ta) {
    await ta.fill("Tell me about a time you had to manage competing project priorities.");
    await page.keyboard.down("Control");
    await page.keyboard.press("Enter");
    await page.keyboard.up("Control");
    await page.waitForTimeout(22000);
  }
  await page.screenshot({ path: `${OUT}/13-live-copilot.png`, fullPage: false });
  console.log("captured 13-live-copilot");
} catch (e) {
  console.log("FAILED live copilot", String(e).slice(0, 90));
}

await browser.close();
console.log("done:", fs.readdirSync(OUT).length, "images");
