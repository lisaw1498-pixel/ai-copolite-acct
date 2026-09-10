// One-off cleanup: removes quotation marks that wrap a whole stored question
// or prepared answer.
//
// Pasting from a document brings the surrounding quotes along, and the value
// is then shown quoted everywhere it appears - including read aloud during a
// mock interview, as if the candidate were quoting someone else.
//
// Run with --apply to write. Without it, this only reports what would change.
//
//   node scripts/strip-stored-quotes.mjs
//   node scripts/strip-stored-quotes.mjs --apply

import Database from "better-sqlite3";
import { stripWrappingQuotes } from "../src/lib/strip-quotes.ts";

const apply = process.argv.includes("--apply");
const db = new Database("data/app.db");

const ANSWER_FIELDS = [
  ["short_answer", "shortAnswer"],
  ["standard_answer", "standardAnswer"],
  ["long_answer", "longAnswer"],
];

let questionsChanged = 0;
let answerFieldsChanged = 0;
const samples = [];

const questions = db.prepare("select id, question from interview_questions").all();
for (const row of questions) {
  const cleaned = stripWrappingQuotes(row.question ?? "");
  if (cleaned === row.question) continue;
  questionsChanged++;
  if (samples.length < 4) samples.push(`Q: ${JSON.stringify(row.question)} -> ${JSON.stringify(cleaned)}`);
  if (apply) {
    db.prepare("update interview_questions set question = ? where id = ?").run(cleaned, row.id);
  }
}

const answers = db
  .prepare("select id, short_answer, standard_answer, long_answer from prepared_answers")
  .all();
for (const row of answers) {
  for (const [column] of ANSWER_FIELDS) {
    const current = row[column];
    if (typeof current !== "string" || !current) continue;
    const cleaned = stripWrappingQuotes(current);
    if (cleaned === current) continue;
    answerFieldsChanged++;
    if (samples.length < 6) {
      samples.push(`A(${column}): ${JSON.stringify(current.slice(0, 50))}... -> ${JSON.stringify(cleaned.slice(0, 50))}...`);
    }
    if (apply) {
      db.prepare(`update prepared_answers set ${column} = ? where id = ?`).run(cleaned, row.id);
    }
  }
}

console.log(samples.join("\n"));
console.log(
  `\n${apply ? "Updated" : "Would update"}: ${questionsChanged} question(s), ${answerFieldsChanged} answer field(s).`
);
if (!apply) console.log("Dry run. Re-run with --apply to write.");
