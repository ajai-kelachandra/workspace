export const TASK_KINDS = ["bug", "requirement", "modification", "enhancement", "feature", "improvement", "task", "chore"] as const;
export type TaskKind = (typeof TASK_KINDS)[number];

export interface ParsedTask {
  /** stable id derived from the normalised text, so re-importing the same list is idempotent */
  id: string;
  title: string;
  description: string;
  /** the cleaned full text without the trailing type tag; this is what gets mapped */
  text: string;
  kind: TaskKind | null;
}

/** 53-bit string hash (cyrb53): small, fast, and plenty for de-duplicating a few thousand tasks. */
function hash(s: string): string {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/**
 * Splits pasted text into raw records. Supports:
 *  - one task per line (usually starting with "- ")
 *  - quoted records that span several lines, with "" as an escaped quote (spreadsheet/CSV style)
 *  - indented lines continuing the previous unquoted record
 */
export function splitRecords(text: string): string[] {
  const src = text.replace(/\r\n?/g, "\n");
  const n = src.length;
  const out: string[] = [];
  let i = 0;
  while (i < n) {
    while (i < n && /\s/.test(src[i])) i++;
    if (i >= n) break;

    if (src[i] === '"') {
      let j = i + 1, buf = "", closed = false;
      while (j < n) {
        if (src[j] === '"') {
          if (src[j + 1] === '"') { buf += '"'; j += 2; continue; }
          closed = true; j++; break;
        }
        buf += src[j++];
      }
      if (closed) {
        out.push(buf);
        while (j < n && src[j] !== "\n") j++; // ignore anything (e.g. a comma) after the closing quote
        i = j;
        continue;
      }
      // unterminated quote: treat just this line as a record
    }

    const end = src.indexOf("\n", i);
    const line = src.slice(i, end < 0 ? n : end);
    out.push(line);
    i = end < 0 ? n : end + 1;
    // indented follow-on lines belong to this record
    while (i < n) {
      const e2 = src.indexOf("\n", i);
      const next = src.slice(i, e2 < 0 ? n : e2);
      if (/^[ \t]+\S/.test(next) && !/^\s*(?:[-*•–—]|\d+[.)])\s/.test(next)) {
        out[out.length - 1] += " " + next.trim();
        i = e2 < 0 ? n : e2 + 1;
      } else break;
    }
  }
  return out;
}

const BULLET = /^(?:[-*•–—]|\d+[.)])\s+/;
const KIND_TAG = new RegExp(`(?:\\s[-–—]\\s*|\\s*[(\\[])(${TASK_KINDS.join("|")})[)\\]]?\\.?\\s*$`, "i");

export function parseTasks(text: string): ParsedTask[] {
  const seen = new Set<string>();
  const tasks: ParsedTask[] = [];
  for (const raw of splitRecords(text)) {
    let body = raw.replace(/\s+/g, " ").trim().replace(BULLET, "").trim();
    if (!body) continue;

    let kind: TaskKind | null = null;
    const tag = KIND_TAG.exec(body);
    if (tag) { kind = tag[1].toLowerCase() as TaskKind; body = body.slice(0, tag.index).trim().replace(/[-–—]$/, "").trim(); }
    if (!body) continue;

    let title: string, description: string;
    const colon = /^([^:.]{3,80}?)\s*:\s+(.+)$/.exec(body);
    const sentence = /^(.{10,100}?)[.!?](?:\s+(.*))?$/.exec(body);
    if (colon) { title = colon[1].trim(); description = colon[2].trim(); }
    else if (sentence) { title = sentence[1].trim(); description = (sentence[2] ?? "").trim(); }
    else if (body.length > 100) { title = body.slice(0, 97).trimEnd() + "…"; description = body; }
    else { title = body.replace(/[.!?]+$/, ""); description = ""; }

    const id = hash(body.toLowerCase());
    if (seen.has(id)) continue; // duplicate lines in one paste
    seen.add(id);
    tasks.push({ id, title, description, text: body, kind });
  }
  return tasks;
}
