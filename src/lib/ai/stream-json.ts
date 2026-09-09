// Incremental extraction of one string field out of a JSON object that is
// still being streamed.
//
// The model returns a single JSON object (say_this + remember_this +
// facts_used + verification metadata). We can't JSON.parse that until the last
// byte arrives, but the blueprint wants the answer painting on screen within
// 1-3 seconds. So we scan the raw token stream for the `say_this` string and
// emit its decoded characters as they arrive, while still parsing the complete
// object normally once the stream finishes.

const ESCAPES: Record<string, string> = {
  n: "\n",
  t: "\t",
  r: "\r",
  b: "\b",
  f: "\f",
  '"': '"',
  "\\": "\\",
  "/": "/",
};

/**
 * Returns a `push(chunk)` function that yields any newly-decoded characters of
 * the target field. Returns "" until the field starts, and "" forever after
 * its closing quote.
 */
export function createStringFieldExtractor(field: string) {
  const marker = new RegExp(`"${field}"\s*:\s*"`);
  let buffer = "";
  let started = false;
  let finished = false;

  return function push(chunk: string): string {
    if (finished) return "";
    buffer += chunk;

    if (!started) {
      const m = buffer.match(marker);
      // The marker itself can be split across chunks, so we keep buffering
      // until it appears in full.
      if (!m || m.index === undefined) return "";
      started = true;
      buffer = buffer.slice(m.index + m[0].length);
    }

    let out = "";
    let i = 0;
    while (i < buffer.length) {
      const ch = buffer[i];

      if (ch === '"') {
        finished = true;
        i++;
        break;
      }

      if (ch === "\\") {
        // Hold back incomplete escape sequences rather than emitting a stray
        // backslash that we'd have to retract.
        if (i + 1 >= buffer.length) break;
        const next = buffer[i + 1];
        if (next === "u") {
          if (i + 6 > buffer.length) break;
          out += String.fromCharCode(parseInt(buffer.slice(i + 2, i + 6), 16));
          i += 6;
          continue;
        }
        out += ESCAPES[next] ?? next;
        i += 2;
        continue;
      }

      out += ch;
      i++;
    }

    buffer = buffer.slice(i);
    return out;
  };
}
