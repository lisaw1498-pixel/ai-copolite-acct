import fs from "fs";
import { SECTIONS } from "./guide-data.mjs";
import { chromium } from "playwright";

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const sections = SECTIONS.map((s, i) => `
  <section class="feature">
    <div class="fhead">
      <span class="num">${String(i + 1).padStart(2, "0")}</span>
      <div>
        <h2>${esc(s.title)}</h2>
        <p class="where">${esc(s.sub)}</p>
      </div>
    </div>
    <figure><img src="img/${s.img}" alt="${esc(s.title)}"></figure>
    <p class="body">${esc(s.body)}</p>
    ${s.tips.length ? `<ul class="tips">${s.tips.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : ""}
  </section>`).join("\n");

const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>AI Interview Copilot - User Guide</title>
<style>
  @page { size: Letter; margin: 16mm 14mm; }
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", Inter, system-ui, sans-serif; color: #111827; margin: 0; font-size: 11pt; line-height: 1.55; }
  h1,h2,h3 { color: #0B1220; margin: 0; }

  .cover { height: 232mm; display: flex; flex-direction: column; justify-content: center; page-break-after: always; }
  .logo { display:inline-flex; align-items:center; gap:10px; margin-bottom: 26px; }
  .logo .mark { width: 40px; height: 40px; border-radius: 10px; background: #2563EB; color:#fff; font-weight:700;
                display:flex; align-items:center; justify-content:center; font-size: 15pt; }
  .cover h1 { font-size: 30pt; letter-spacing: -0.5px; line-height: 1.15; }
  .cover .tag { font-size: 13pt; color: #2563EB; margin-top: 12px; font-weight: 600; }
  .cover .lede { font-size: 11.5pt; color: #374151; margin-top: 20px; max-width: 135mm; }
  .rule { margin-top: 30px; padding: 16px 18px; background: #F8FAFC; border-left: 4px solid #14B8A6; border-radius: 6px; }
  .meta { margin-top: auto; font-size: 9.5pt; color: #6B7280; }

  .toc { page-break-after: always; }
  .toc h2 { font-size: 16pt; margin-bottom: 14px; }
  .toc ol { columns: 2; column-gap: 16mm; padding-left: 18px; font-size: 10.5pt; }
  .toc li { margin-bottom: 7px; break-inside: avoid; }

  .feature { page-break-before: always; page-break-inside: avoid; }
  .fhead { display: flex; gap: 12px; align-items: flex-start; margin-bottom: 12px; }
  .num { background:#0B1220; color:#fff; font-size:9pt; font-weight:700; border-radius:6px; padding: 4px 8px; margin-top: 3px; }
  .feature h2 { font-size: 17pt; letter-spacing: -0.2px; }
  .where { color:#2563EB; font-size: 9.5pt; font-weight: 600; margin-top: 2px; }
  figure { margin: 0 0 12px; border:1px solid #E2E8F0; border-radius: 8px; overflow: hidden; background:#fff; }
  figure img { width: 100%; display: block; }
  .body { margin: 0 0 10px; color:#374151; }
  .tips { margin: 0; padding-left: 18px; font-size: 10pt; color:#374151; }
  .tips li { margin-bottom: 4px; }

  .page { page-break-before: always; }
  .page h2 { font-size: 17pt; margin-bottom: 12px; }
  table { width:100%; border-collapse: collapse; font-size: 10pt; margin-bottom: 18px; }
  th, td { text-align:left; padding: 7px 9px; border-bottom: 1px solid #E2E8F0; vertical-align: top; }
  th { background:#F8FAFC; font-size: 9pt; text-transform: uppercase; letter-spacing: .4px; color:#6B7280; }
  kbd { background:#0B1220; color:#fff; border-radius:4px; padding:1px 6px; font-size:9pt; font-family:inherit; }
  .note { background:#FFFBEB; border-left:4px solid #F59E0B; padding: 12px 15px; border-radius:6px; font-size:10pt; margin-bottom:14px; }
  .good { background:#F0FDF4; border-left:4px solid #22C55E; padding: 12px 15px; border-radius:6px; font-size:10pt; margin-bottom:14px; }
  h3 { font-size: 11.5pt; margin: 16px 0 7px; }
</style></head>
<body>

<div class="cover">
  <div class="logo"><span class="mark">AI</span><span style="font-weight:600;font-size:12pt">Interview Copilot</span></div>
  <h1>User Guide</h1>
  <div class="tag">Your experience. Your answers. Real-time interview support.</div>
  <p class="lede">This guide walks through every feature built so far, with a screenshot of each screen, so you can find your way around before an interview rather than during one.</p>
  <div class="rule">
    <strong>The one rule this product is built on.</strong><br>
    It never invents experience you do not have. Every claim about your background traces back to your resume, a story you wrote, or something you confirmed yourself. Numbers are checked against your evidence before you ever see them. If it cannot support something, it removes it and tells you &mdash; or says plainly that you do not have that experience, and bridges to what you do have.
  </div>
  <div class="meta">Generated ${today} &nbsp;&middot;&nbsp; Screenshots taken from your own account</div>
</div>

<div class="toc">
  <h2>What is in here</h2>
  <ol>${SECTIONS.map((s) => `<li>${esc(s.title)}</li>`).join("")}
    <li>Keyboard shortcuts</li><li>Getting the best out of it</li><li>What it will and will not do</li><li>If something goes wrong</li></ol>
</div>

${sections}

<div class="page">
  <h2>Keyboard shortcuts</h2>
  <p class="body">These work during a live interview, when your hands should be nowhere near the mouse.</p>
  <table>
    <tr><th>Key</th><th>Does</th></tr>
    <tr><td><kbd>Q</kbd></td><td>Quick Glance &mdash; strips the screen down to cues only</td></tr>
    <tr><td><kbd>S</kbd></td><td>Rebuild the answer in STAR shape</td></tr>
    <tr><td><kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd></td><td>Answer length: about 15, 30 or 60 seconds</td></tr>
    <tr><td><kbd>R</kbd></td><td>Regenerate the answer</td></tr>
    <tr><td><kbd>M</kbd></td><td>Jump to the box to type a question</td></tr>
    <tr><td><kbd>P</kbd></td><td>Pause or resume listening</td></tr>
    <tr><td><kbd>H</kbd></td><td>Hide &mdash; shrink to Discreet mode</td></tr>
    <tr><td><kbd>Ctrl</kbd> + <kbd>Enter</kbd></td><td>Send a typed question</td></tr>
  </table>

  <h2>Getting the best out of it</h2>
  <h3>Before an interview</h3>
  <ul class="tips">
    <li>Add the job posting and let the match analysis run &mdash; it drives the questions you are asked in practice.</li>
    <li>Read your true gaps and rehearse those answers. They are the questions most likely to catch you out.</li>
    <li>Confirm anything sitting in Needs Review, or it stays out of your live answers.</li>
    <li>Do at least one mock interview out loud. Reading an answer is not the same skill as saying it.</li>
  </ul>
  <h3>During a live interview</h3>
  <ul class="tips">
    <li>Glance at REMEMBER THIS, not SAY THIS. Reading a paragraph aloud sounds exactly like reading a paragraph aloud.</li>
    <li>If the audio misses a question, type it &mdash; faster than waiting or repeating yourself.</li>
    <li>Use a second screen or Compact mode so you are not visibly reading.</li>
  </ul>
</div>

<div class="page">
  <h2>What it will and will not do</h2>
  <div class="good">
    <strong>It will refuse to invent.</strong> Asked for a metric you cannot prove, it says so. Asked about a platform you have not used, it says that plainly and bridges to the closest thing you have actually done. Asked for a dramatic conflict story when your history does not contain one, it will tell you it would rather not make one up. That is deliberate: you have to keep defending whatever it says for the next ten minutes.
  </div>
  <div class="note">
    <strong>Known limits, stated honestly.</strong>
    <ul style="margin:8px 0 0;padding-left:18px">
      <li>It cannot tell your voice from the interviewer's. With one microphone there is no speaker separation, so it may occasionally treat something you say as a question. Press <kbd>P</kbd> to pause while you talk.</li>
      <li>Speech recognition is imperfect and will mishear words. Answers are still generated correctly from noisy text.</li>
      <li>Number checking is automatic and reliable. Narrative checking &mdash; people, events, details &mdash; relies on instructions to the model, which is a weaker guarantee. If you see an answer describing a person or event you do not recognise, that is worth reporting.</li>
      <li>Live interviews need Chrome or Edge on a desktop. Voice features do not work in Firefox or Safari.</li>
      <li>Resume analysis takes a minute or two, and the post-interview report about forty seconds. Both run in the background so you are never stuck waiting on a frozen screen.</li>
    </ul>
  </div>

  <h2>If something goes wrong</h2>
  <table>
    <tr><th>What you see</th><th>What to do</th></tr>
    <tr><td>Credit balance is too low</td><td>Add credits at console.anthropic.com under Plans &amp; Billing. Turn on auto-reload so it cannot happen mid-interview.</td></tr>
    <tr><td>Nothing happens when you speak</td><td>Check the header says LISTENING and that the browser has microphone permission. Type the question as a fallback.</td></tr>
    <tr><td>Analysis stopped unexpectedly</td><td>The server restarted mid-job. Press the retry button on the card.</td></tr>
    <tr><td>The voice sounds robotic</td><td>Windows Settings &rarr; Time &amp; Language &rarr; Speech &rarr; Add voices. Install Aria or Jenny; they are picked up automatically.</td></tr>
    <tr><td>An answer mentions something you do not recognise</td><td>Report it. Narrative grounding is the weakest guarantee in the system, and that is the failure mode to watch for.</td></tr>
  </table>
</div>

</body></html>`;

fs.writeFileSync("docs/user-guide.html", html);

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage();
const fileUrl = "file:///" + process.cwd().replace(/\\/g, "/") + "/docs/user-guide.html";
await page.goto(fileUrl, { waitUntil: "networkidle" });
await page.pdf({ path: "docs/AI-Interview-Copilot-User-Guide.pdf", format: "Letter", printBackground: true });
await browser.close();
console.log("PDF written");
