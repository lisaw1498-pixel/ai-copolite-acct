import { chromium } from "playwright";
import { pathToFileURL } from "url";
import path from "path";

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage();
await page.setViewportSize({ width: 1100, height: 1400 });
await page.goto(pathToFileURL(path.resolve("docs/user-guide.html")).href, { waitUntil: "networkidle" });

const imgs = await page.evaluate(() =>
  [...document.images].map((i) => ({ src: i.getAttribute("src"), ok: i.complete && i.naturalWidth > 0 }))
);
const broken = imgs.filter((i) => !i.ok);
const sections = await page.evaluate(() =>
  [...document.querySelectorAll("section.feature h2")].map((h) => h.textContent)
);
console.log("images:", imgs.length, "| broken:", broken.length);
if (broken.length) console.log("broken:", broken.map((b) => b.src).join(", "));
console.log("sections:", sections.length);
console.log(sections.map((s, i) => `  ${i + 1}. ${s}`).join("\n"));
await browser.close();
