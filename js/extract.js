// Meeting insight extraction — pure functions over transcript text.

const ACTION_RES = [
  /\baction item[s]?\b[:\s]/i,
  /\b(?:todo|to-do|to do)\b[:\s]/i,
  /\b\w+\s+(?:will|to)\s+(?:prepare|review|send|draft|finalize|check|update|schedule|book|follow up|complete|submit|share|organize|fix|test|deploy|write|call|email|confirm|research|audit|budget)\b/i,
  /\b(?:need to|needs to|have to|has to|must)\s+\w+/i,
  /\b(?:by|before)\s+(?:friday|monday|tuesday|wednesday|thursday|tomorrow|next week|end of (?:day|week|month)|eod|eow)\b/i,
];

const DECISION_RES = [
  /\b(?:we|they|the team)\s+(?:agreed|decided|resolved|concluded)\b/i,
  /\b(?:agreed|decided|approved|confirmed)\s+to\b/i,
  /\b(?:let'?s|we will|we'll)\s+(?:go with|move|ship|launch|use|adopt|postpone|push)\b/i,
  /\bdecision\b[:\s]/i,
];

const OWNER_RE = /\b([A-Z][a-z]+)\s+(?:will|to)\s+/;
const DEADLINE_RE = /\b((?:by|before)\s+(?:friday|monday|tuesday|wednesday|thursday|tomorrow|next week|end of (?:day|week|month)|eod|eow|[\w ]{3,20}))\b/i;

export function classifySentence(text) {
  const t = text.trim();
  if (!t) return null;
  const isAction = ACTION_RES.some((r) => r.test(t));
  const isDecision = DECISION_RES.some((r) => r.test(t));
  let kind = "note";
  if (isAction && isDecision) kind = "action"; // action wins for listing
  else if (isAction) kind = "action";
  else if (isDecision) kind = "decision";
  const owner = (t.match(OWNER_RE) || [])[1] || null;
  const deadline = (t.match(DEADLINE_RE) || [])[1] || null;
  return { kind, owner, deadline, text: t };
}

// Split transcript text into sentences (keep punctuation).
export function splitSentences(text) {
  return (text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [])
    .map((s) => s.trim())
    .filter((s) => s.length > 1);
}

export function extractInsights(text) {
  const actions = [], decisions = [];
  for (const s of splitSentences(text)) {
    const c = classifySentence(s);
    if (!c) continue;
    if (c.kind === "action") actions.push(c);
    else if (c.kind === "decision") decisions.push(c);
  }
  return { actions, decisions };
}

const STOP = new Set(("the a an and or but of to in on at for with is are was were be been we they you i he she it this that these those will would shall should can could may might do does did have has had not no yes so if then than as by from up out about into over after before between during without within " +
  "let let's get got go going okay alright all right any other every some just also really very much more most now today tomorrow yesterday here there what when where who how why which " +
  "need needs want wants think know say said says tell told great good well sure thing things everyone somebody anyone meeting started start").split(" "));

export function keywords(text, n = 8) {
  const freq = {};
  for (const w of (text.toLowerCase().match(/[a-z][a-z'-]{2,}/g) || [])) {
    if (STOP.has(w)) continue;
    freq[w] = (freq[w] || 0) + 1;
  }
  return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, n).map(([w, c]) => ({ word: w, count: c }));
}

export function wordCount(text) {
  return (text.trim().match(/\S+/g) || []).length;
}