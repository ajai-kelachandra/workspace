import type { GraphIndex } from "@/features/graph/graphIndex";

export interface StartResolution {
  nodeIds: string[];
  matchedBy: "file" | "module" | "keyword";
  /** 0..1 - how sure we are about the mapping */
  confidence: number;
  modules: string[];
  /** human-readable account of what matched and what was ignored */
  explain: string;
}

/** Filler words in task text that say nothing about *where* the change is. */
const STOP_WORDS = (
  "a an the in on at to of for from with by and or but if then when while is are was were be been being it its this that these those " +
  "as into onto over under after before not no do does did done have has had can could should would will may might just only also via per " +
  "edit edited editing update updated updating change changed changing fix fixed fixing add added adding new save saved saving " +
  "remove removed delete deleted make made need needs needed issue bug task ticket please page pages component components screen"
).split(" ");/** Stop words are compared after stemming, so include the stemmed forms ("saved" -> "sav"). */
const STOP = new Set([...STOP_WORDS, ...STOP_WORDS.map((w) => stem(w))]);


/** Path segments / extensions that appear everywhere and carry no meaning. */
const NOISE = new Set(["app", "src", "components", "component", "tsx", "ts", "js", "jsx", "index", "locale", "page"]);

/**
 * Words that rarely appear in file names but map onto words that do. Matched at lower weight than
 * the original word. Extend per repository when a codebase uses different vocabulary.
 */
export const SYNONYMS: Record<string, string[]> = {
  popup: ["modal", "dialog", "popover"], modal: ["popup", "dialog"], dialog: ["modal", "popup"],
  menu: ["navbar", "dropdown", "nav"], navigation: ["navbar", "nav"], dropdown: ["menu"],
  header: ["navbar"], navbar: ["menu", "header"],
  login: ["signin", "auth"], signin: ["login"], logout: ["signout"], signup: ["register", "createaccount"], register: ["signup", "createaccount"],
  redirect: ["middleware"], locked: ["middleware"], lock: ["middleware"], guard: ["middleware"], permission: ["middleware"],
  access: ["middleware"], mandatory: ["complete", "required"], required: ["complete"], onboarding: ["complete"],
  survey: ["nps", "csat"], rating: ["csat", "nps"], feedback: ["csat", "nps"],
  timeline: ["history"], card: ["tile"], table: ["grid", "list"],
};

/** Generic words that match many unrelated files; they count for less. */
const WEAK = new Set(["detail", "info", "data", "item", "list", "view", "user", "number", "open", "show", "display", "send", "sent", "name", "text", "new"]);

function stem(w: string): string {
  if (w.length > 5 && w.endsWith("ing")) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith("ies")) return w.slice(0, -3) + "y";
  if (w.length > 4 && w.endsWith("ed")) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}

/** "components/EventDashboard/CreateEventForm.tsx" -> ["event","dashboard","create","event","form"] */
export function tokenize(text: string, drop: (t: string) => boolean): string[] {
  return text
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2)
    .map(stem)
    .filter((t) => !drop(t));
}

const PATH_IN_TEXT = /[\w@[\]().-]+(?:\/[\w@[\]().-]+)+(?:\.\w+)?|[\w-]+\.(?:tsx?|jsx?)/g;

/**
 * Resolves free text (a task title, a file path, a module id) to start nodes.
 * Priority: explicit file path -> explicit module -> keyword match.
 *
 * Keyword matching is word-level and weighted (rare words count more, adjacent words such as
 * "event form" get a phrase bonus, filler like "edit"/"saved"/"added" is ignored). Only files that
 * score close to the best match are returned, so a task about one form marks that form (and, via
 * the impact engine, the pages that use it) rather than a whole module.
 */
export function resolveStart(index: GraphIndex, query: string): StartResolution | null {
  const q = query.trim();
  if (!q) return null;
  const files = [...index.nodes.values()].filter((n) => n.kind === "file");
  const pathOf = (n: { id: string; path?: string }) => (n.path ?? n.id).toLowerCase();

  // 1. explicit file paths: the whole input, comma/newline separated, or paths quoted inside a sentence
  const parts = [...q.split(/[,;\n]+/), ...(q.match(PATH_IN_TEXT) ?? [])].map((s) => s.trim().toLowerCase()).filter(Boolean);
  const hit = new Set<string>();
  let exact = 0;
  for (const p of new Set(parts)) {
    const found = files.filter((n) => pathOf(n) === p || (/[/.]/.test(p) && pathOf(n).endsWith("/" + p)));
    if (found.length) exact++;
    found.forEach((n) => hit.add(n.id));
  }
  if (hit.size) {
    return finish([...hit], "file", exact === new Set(parts).size ? 1 : 0.9, `Matched ${hit.size} file path${hit.size === 1 ? "" : "s"}`);
  }

  // 2. explicit module
  const lower = q.toLowerCase();
  const mod = index.graph.modules.find((m) => m.id.toLowerCase() === lower)
    ?? index.graph.modules.find((m) => lower.length >= 3 && m.id.toLowerCase().includes(lower));
  if (mod) return finish(index.byModule.get(mod.id) ?? [], "module", mod.id.toLowerCase() === lower ? 0.85 : 0.75, `Whole module ${mod.id}`);

  // 3. keywords: weighted word matching with synonyms
  let qTokens = [...new Set(tokenize(q, (t) => STOP.has(t)))];
  if (!qTokens.length) qTokens = [...new Set(tokenize(q, () => false))]; // all words were filler: use them anyway
  if (!qTokens.length) return null;

  const docs = files.map((n) => {
    const p = n.path ?? n.id;
    const seq = tokenize(p, (t) => NOISE.has(t));
    const base = new Set(tokenize(p.split("/").pop() ?? p, (t) => NOISE.has(t)));
    return { id: n.id, seq, set: new Set(seq), base };
  });
  const df = new Map<string, number>();
  for (const d of docs) for (const t of d.set) df.set(t, (df.get(t) ?? 0) + 1);
  const idf = (t: string) => Math.log(1 + docs.length / (df.get(t) ?? 1));

  // query terms: the words themselves, plus synonyms at a lower weight
  const weightOf = (t: string) => (WEAK.has(t) ? 0.4 : 1);
  const terms = new Map<string, { w: number; origin: string }>();
  for (const t of qTokens) terms.set(t, { w: weightOf(t), origin: t });
  for (const t of qTokens) {
    for (const syn of (SYNONYMS[t] ?? []).map(stem)) {
      if (!terms.has(syn)) terms.set(syn, { w: 0.6 * weightOf(t), origin: t });
    }
  }
  const termList = [...terms].filter(([t]) => df.has(t));

  const scored = docs.map((d) => {
    let score = 0;
    // original query words this file covers (directly or via a synonym) -> best weight that covered them
    const matched = new Map<string, number>();
    for (const [t, { w, origin }] of termList) {
      if (!d.set.has(t)) continue;
      score += idf(t) * w * (d.base.has(t) ? 1.5 : 1);
      matched.set(origin, Math.max(matched.get(origin) ?? 0, idf(t) * w));
    }
    // phrase bonus: consecutive query words that sit next to each other in the path ("event form")
    for (let i = 0; i + 1 < qTokens.length; i++) {
      const a = qTokens[i], b = qTokens[i + 1];
      if (!d.set.has(a) || !d.set.has(b)) continue;
      for (let k = 0; k + 1 < d.seq.length; k++) {
        if ((d.seq[k] === a && d.seq[k + 1] === b) || (d.seq[k] === b && d.seq[k + 1] === a)) { score += 0.75 * (idf(a) + idf(b)); break; }
      }
    }
    return { id: d.id, score, matched };
  }).filter((s) => s.score > 0).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));

  if (scored.length) {
    const top = scored[0].score;
    const tied = scored.filter((s) => s.score >= top * 0.8);
    const keep = tied.slice(0, 10);
    const coveredBy = new Map<string, number>();
    for (const k of keep) for (const [t, w] of k.matched) coveredBy.set(t, Math.max(coveredBy.get(t) ?? 0, w));
    const covered = new Set(coveredBy.keys());

    // confidence: how much of the (weighted) task text the chosen files explain
    const coveredW = [...coveredBy.values()].reduce((sum, w) => sum + w, 0);
    const avg = coveredW / Math.max(1, covered.size);
    const missingW = qTokens.filter((t) => !covered.has(t))
      .reduce((sum, t) => sum + (df.has(t) ? idf(t) * weightOf(t) : 0.25 * avg * weightOf(t)), 0);
    const coverage = coveredW / (coveredW + missingW || 1);
    let confidence = 0.15 + 0.7 * Math.pow(coverage, 1.5);
    if (keep.length > 5) confidence *= 0.85;
    if (tied.length > 10) confidence *= 0.6; // many equally good files: the words are too generic to pin one down
    confidence = Math.min(0.85, confidence);

    const missing = qTokens.filter((t) => !covered.has(t) && !STOP.has(t));
    return finish(keep.map((k) => k.id), "keyword", confidence,
      `Matched “${[...covered].join(" ")}”${missing.length ? ` · no file for: ${missing.join(", ")}` : ""}${tied.length > 10 ? ` · ${tied.length} similar files, showing top 10` : ""}`);
  }

  // fall back to the module keyword lists: coarse, so low confidence
  const modHits = index.graph.modules
    .map((m) => ({ id: m.id, hits: m.keywords.filter((k) => q.toLowerCase().includes(k) || qTokens.some((t) => k.includes(t))).length }))
    .filter((m) => m.hits);
  if (!modHits.length) return null;
  const best = Math.max(...modHits.map((m) => m.hits));
  const top = modHits.filter((m) => m.hits === best);
  return finish(top.flatMap((m) => index.byModule.get(m.id) ?? []), "keyword", 0.3,
    `No specific file matched; using whole module${top.length > 1 ? "s" : ""} ${top.map((m) => m.id).join(", ")}`);

  function finish(nodeIds: string[], matchedBy: StartResolution["matchedBy"], confidence: number, explain: string): StartResolution {
    const modules = [...new Set(nodeIds.map((id) => index.nodes.get(id)?.module).filter((m): m is string => !!m))];
    return { nodeIds, matchedBy, confidence, modules, explain };
  }
}
