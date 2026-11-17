import { initASR, asrReady, getLoadMs, transcribe } from "./asr.js";
import { extractInsights, keywords, wordCount, classifySentence } from "./extract.js";
import { loadDemoAudio, MicRecorder } from "./audio.js";

const $ = (id) => document.getElementById(id);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const SVG = (p, c) => `<svg viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const ICONS = {
  load: SVG('<circle cx="12" cy="12" r="9" stroke-dasharray="4 3"/>', "#fbbf24"),
  ready: SVG('<circle cx="12" cy="12" r="9"/><path d="M8.5 12.5l2.5 2.5 4.5-5"/>', "#4ade80"),
  mic: SVG('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>', "#fb7185"),
  busy: SVG('<path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>', "#fbbf24"),
  doc: SVG('<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>', "#fbbf24"),
};

// ---- sound ----
let actx = null;
function blip(freq, dur = 0.1, type = "sine", gain = 0.05) {
  if (!tune.sound) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const t = actx.currentTime, o = actx.createOscillator(), g = actx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(actx.destination); o.start(t); o.stop(t + dur + 0.03);
  } catch {}
}
const sfx = { ui: () => blip(660, 0.08), ready: () => { blip(523, 0.15); setTimeout(() => blip(784, 0.2), 110); }, seg: () => blip(880, 0.06, "triangle", 0.03), err: () => blip(220, 0.2, "square", 0.04) };

// ---- persistence ----
const TUNE_KEY = "ms-tuning-v1";
const DEFAULT_TUNE = { chunkSec: 8, autoScroll: true, sound: true };
let tune = { ...DEFAULT_TUNE };
const store = {
  get(k) { return new Promise((res) => { try { chrome.storage.local.get([k], (o) => res(o[k])); } catch { res(null); } }); },
  set(k, v) { try { chrome.storage.local.set({ [k]: v }); } catch {} },
};

// ---- state ----
let srcKind = "demo", recording = false, ready = false;
let segments = [], fullText = "", durationSec = 0, transcribeMs = 0;
let liveElapsed = 0, pending = 0, events = [];
let queue = Promise.resolve();
const mic = new MicRecorder();

function enqueue(fn) { pending++; updateBanner(); queue = queue.then(fn).catch((e) => addLog("alert", "Transcription error: " + (e.message || e))).finally(() => { pending--; updateBanner(); }); return queue; }

// ---- log / toast ----
function fmtClock(s) { s = Math.max(0, Math.round(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; }
function addLog(kind, msg) {
  events.push({ t: Date.now(), kind, msg });
  if (events.length > 200) events.shift();
  const li = document.createElement("li");
  li.className = kind;
  const d = new Date();
  li.innerHTML = `<time>${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}</time><b></b>`;
  li.querySelector("b").textContent = msg;
  $("log").prepend(li);
  while ($("log").children.length > 60) $("log").removeChild($("log").lastChild);
}
let toastTimer = null;
function toast(msg) { const t = $("toast"); t.textContent = msg; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 2600); }

// ---- banner ----
function updateBanner() {
  const b = $("statusBanner");
  if (!ready) { b.className = "status-banner"; $("statusIcon").innerHTML = ICONS.load; $("statusTitle").textContent = "Loading model"; $("statusHint").textContent = "Initialising Whisper tiny.en (quantized) from the local bundle…"; $("loadBar").hidden = false; return; }
  $("loadBar").hidden = true;
  if (pending > 0) { b.className = "status-banner busy"; $("statusIcon").innerHTML = ICONS.busy; $("statusTitle").textContent = "Transcribing…"; $("statusHint").textContent = `${pending} audio chunk${pending > 1 ? "s" : ""} in the queue · Whisper runs locally`; return; }
  if (recording) { b.className = "status-banner rec"; $("statusIcon").innerHTML = ICONS.mic; $("statusTitle").textContent = "Recording"; $("statusHint").textContent = `Capturing mic in ${tune.chunkSec}s chunks · ${fmtClock(liveElapsed)} elapsed`; return; }
  b.className = "status-banner ready"; $("statusIcon").innerHTML = ICONS.ready; $("statusTitle").textContent = "Ready"; $("statusHint").textContent = segments.length ? `${segments.length} segments · ${wordCount(fullText)} words transcribed` : "Press DEMO MEETING or start a live recording.";
}

// ---- rendering ----
function highlight(text, q) {
  if (!q) return escapeHtml(text);
  const re = new RegExp("(" + q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "ig");
  return escapeHtml(text).replace(re, "<mark>$1</mark>");
}
function escapeHtml(s) { return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

function renderSegment(seg, q) {
  const div = document.createElement("div");
  div.className = "seg " + seg.kind;
  const tag = seg.kind === "action" ? '<span class="tag">action</span>' : seg.kind === "decision" ? '<span class="tag">decision</span>' : "";
  div.innerHTML = `<time>${fmtClock(seg.start)}</time><p>${tag}${highlight(seg.text, q)}</p>`;
  if (q && !seg.text.toLowerCase().includes(q.toLowerCase())) div.classList.add("hide");
  return div;
}
function renderTranscript() {
  const q = $("search").value.trim();
  const box = $("transcript");
  box.innerHTML = "";
  if (!segments.length) { box.innerHTML = '<p class="empty">No transcript yet.</p>'; return; }
  for (const s of segments) box.appendChild(renderSegment(s, q));
  if (tune.autoScroll) box.scrollTop = box.scrollHeight;
}
function renderInsights() {
  const { actions, decisions } = extractInsights(fullText);
  const al = $("actions"); al.innerHTML = "";
  $("actCount").textContent = actions.length;
  if (!actions.length) al.innerHTML = '<li class="none">None yet.</li>';
  for (const a of actions) {
    const li = document.createElement("li");
    let chips = "";
    if (a.owner) chips += `<span class="meta-chip owner">${escapeHtml(a.owner)}</span>`;
    if (a.deadline) chips += `<span class="meta-chip deadline">${escapeHtml(a.deadline)}</span>`;
    li.innerHTML = `<b></b><br>${chips}`;
    li.querySelector("b").textContent = a.text;
    al.appendChild(li);
  }
  const dl = $("decisions"); dl.innerHTML = "";
  $("decCount").textContent = decisions.length;
  if (!decisions.length) dl.innerHTML = '<li class="none">None yet.</li>';
  for (const d of decisions) { const li = document.createElement("li"); li.innerHTML = "<b></b>"; li.querySelector("b").textContent = d.text; dl.appendChild(li); }
  const kw = $("keywords"); kw.innerHTML = "";
  const kws = keywords(fullText, 8);
  if (!kws.length) kw.innerHTML = '<span class="none">—</span>';
  for (const k of kws) { const s = document.createElement("span"); s.className = "kw"; s.innerHTML = `${escapeHtml(k.word)} <b>${k.count}</b>`; kw.appendChild(s); }
}
function renderStats() {
  const words = wordCount(fullText);
  $("stDur").textContent = fmtClock(durationSec);
  $("stSeg").textContent = segments.length;
  $("stWords").textContent = words;
  $("pillWords").textContent = "WORDS " + words;
  const wpm = durationSec > 3 ? Math.round(words / (durationSec / 60)) : null;
  $("stWpm").textContent = wpm === null ? "–" : wpm;
  $("pillWpm").textContent = "WPM " + (wpm === null ? "–" : wpm);
  $("stLoad").textContent = getLoadMs() ? (getLoadMs() / 1000).toFixed(1) + "s" : "–";
  const rtf = durationSec > 0 && transcribeMs > 0 ? (transcribeMs / 1000 / durationSec) : null;
  $("stRtf").textContent = rtf === null ? "–" : rtf.toFixed(2) + "×";
}
function refresh() { renderTranscript(); renderInsights(); renderStats(); updateBanner(); }

// ---- demo ----
async function runDemo() {
  if (!ready) { toast("Model still loading…"); return; }
  stopRecording();
  srcKind = "demo";
  $("btnDemo").classList.add("active"); $("btnLive").classList.remove("active");
  $("btnRecord").hidden = true;
  $("srcNote").textContent = "Bundled 27s meeting · espeak voice";
  addLog("info", "Demo transcription started");
  await enqueue(async () => {
    const { audio, duration } = await loadDemoAudio("audio/meeting-demo.wav");
    const out = await transcribe(audio, { timestamps: true });
    segments = out.chunks.map((c) => ({ start: c.start || 0, end: c.end || 0, text: c.text, kind: classifySentence(c.text)?.kind || "note" }));
    if (!segments.length && out.text) segments = [{ start: 0, end: duration, text: out.text, kind: classifySentence(out.text)?.kind || "note" }];
    fullText = out.text; durationSec = duration; transcribeMs = out.ms;
    addLog("good", `Demo transcribed: ${segments.length} segments in ${(out.ms / 1000).toFixed(1)}s`);
    sfx.ready();
    refresh();
  });
}

// ---- live ----
function switchLive() {
  if (!ready) { toast("Model still loading…"); return; }
  srcKind = "live";
  $("btnLive").classList.add("active"); $("btnDemo").classList.remove("active");
  $("btnRecord").hidden = false;
  $("srcNote").textContent = "Microphone · chunked local transcription";
  addLog("info", "Live mode selected");
  sfx.ui();
  updateBanner();
}
async function startRecording() {
  try {
    liveElapsed = 0;
    mic.chunkMs = tune.chunkSec * 1000;
    mic.onChunk = (audio, dur) => {
      const start = liveElapsed; liveElapsed += dur;
      enqueue(async () => {
        const out = await transcribe(audio, { timestamps: false });
        if (out.text) {
          segments.push({ start, end: start + dur, text: out.text, kind: classifySentence(out.text)?.kind || "note" });
          fullText = segments.map((s) => s.text).join(" ");
          durationSec = liveElapsed; transcribeMs += out.ms;
          sfx.seg();
          addLog("good", `Chunk @ ${fmtClock(start)}: ${out.text.slice(0, 60)}${out.text.length > 60 ? "…" : ""}`);
          refresh();
        }
      });
    };
    mic.onEnded = () => { stopRecording(); toast("Microphone ended"); };
    await mic.start(tune.chunkSec * 1000);
    recording = true;
    $("btnRecord").classList.add("on"); $("btnRecord").textContent = "■ STOP";
    addLog("warn", "Recording started");
    sfx.ui();
    updateBanner();
  } catch (e) {
    addLog("alert", "Mic unavailable: " + (e.name || e.message || e));
    toast("Microphone unavailable");
    sfx.err();
  }
}
function stopRecording() {
  if (!recording && !mic.recording) return;
  mic.stop();
  recording = false;
  $("btnRecord").classList.remove("on"); $("btnRecord").textContent = "● RECORD";
  addLog("info", "Recording stopped");
  updateBanner();
}

// ---- export ----
function download(name, text, type) {
  const blob = new Blob([text], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  toast("Exported " + name);
  addLog("info", "Exported " + name);
}
function exportTxt() {
  const lines = segments.map((s) => `[${fmtClock(s.start)}] ${s.text}`);
  download("meetingscribe.txt", lines.join("\n\n") + "\n", "text/plain");
}
function exportMd() {
  const { actions, decisions } = extractInsights(fullText);
  let md = "# Meeting transcript\n\n";
  for (const s of segments) md += `- **[${fmtClock(s.start)}]** ${s.text}\n`;
  md += "\n## Action items\n\n";
  md += actions.length ? actions.map((a) => `- [ ] ${a.text}${a.owner ? ` — **${a.owner}**` : ""}${a.deadline ? ` (${a.deadline})` : ""}`).join("\n") : "_None_";
  md += "\n\n## Decisions\n\n";
  md += decisions.length ? decisions.map((d) => `- ${d.text}`).join("\n") : "_None_";
  download("meetingscribe.md", md + "\n", "text/markdown");
}
function exportJson() {
  const { actions, decisions } = extractInsights(fullText);
  const obj = { app: "MeetingScribe", version: "1.0.0", generated: new Date().toISOString(), durationSec: Math.round(durationSec), words: wordCount(fullText), segments, actions, decisions, keywords: keywords(fullText, 12) };
  download("meetingscribe.json", JSON.stringify(obj, null, 2), "application/json");
}

// ---- bindings ----
function bind() {
  $("btnDemo").onclick = runDemo;
  $("btnLive").onclick = switchLive;
  $("btnRecord").onclick = () => { recording ? stopRecording() : startRecording(); };
  $("search").oninput = renderTranscript;
  $("tScroll").onchange = (e) => { tune.autoScroll = e.target.checked; store.set(TUNE_KEY, tune); };
  $("tChunk").oninput = (e) => { tune.chunkSec = +e.target.value; $("vChunk").textContent = e.target.value + "s"; store.set(TUNE_KEY, tune); if (recording) { stopRecording(); startRecording(); } };
  $("btnSound").onclick = () => { tune.sound = !tune.sound; $("btnSound").textContent = tune.sound ? "SOUND ON" : "SOUND OFF"; store.set(TUNE_KEY, tune); if (tune.sound) sfx.ui(); };
  $("btnTxt").onclick = exportTxt;
  $("btnMd").onclick = exportMd;
  $("btnJson").onclick = exportJson;
  $("btnClear").onclick = () => { stopRecording(); segments = []; fullText = ""; durationSec = 0; transcribeMs = 0; liveElapsed = 0; refresh(); addLog("info", "Transcript cleared"); sfx.ui(); };
  $("btnClearLog").onclick = () => { $("log").innerHTML = ""; events = []; sfx.ui(); };
  $("btnHelp").onclick = () => { $("helpModal").hidden = false; sfx.ui(); };
  $("btnCloseHelp").onclick = () => { $("helpModal").hidden = true; sfx.ui(); };
  $("helpModal").onclick = (e) => { if (e.target === $("helpModal")) $("helpModal").hidden = true; };
}

// ---- boot ----
async function boot() {
  bind();
  const saved = await store.get(TUNE_KEY);
  if (saved) tune = { ...DEFAULT_TUNE, ...saved };
  $("tChunk").value = tune.chunkSec; $("vChunk").textContent = tune.chunkSec + "s";
  $("tScroll").checked = tune.autoScroll;
  $("btnSound").textContent = tune.sound ? "SOUND ON" : "SOUND OFF";
  addLog("info", "MeetingScribe started");
  updateBanner();
  try {
    await initASR((p) => {
      if (p.status === "progress" && p.total) {
        $("loadFill").style.width = clamp(Math.round((p.loaded / p.total) * 100), 0, 100) + "%";
      } else if (p.status === "done") { $("loadFill").style.width = "100%"; }
    });
    ready = true;
    $("pillModel").textContent = "MODEL READY";
    $("pillModel").classList.add("ok");
    addLog("good", `Whisper ready in ${(getLoadMs() / 1000).toFixed(1)}s`);
    sfx.ready();
    updateBanner();
    runDemo(); // auto-run demo on first load
  } catch (e) {
    $("pillModel").textContent = "MODEL FAILED";
    $("pillModel").classList.add("warn");
    addLog("alert", "Model init failed: " + (e.message || e));
    toast("Model failed to load");
    updateBanner();
  }
}

window.__ms = {
  get ready() { return ready; },
  get loadMs() { return getLoadMs(); },
  get srcKind() { return srcKind; },
  get recording() { return recording; },
  get pending() { return pending; },
  get segments() { return segments; },
  get fullText() { return fullText; },
  get words() { return wordCount(fullText); },
  get durationSec() { return durationSec; },
  get transcribeMs() { return transcribeMs; },
  get insights() { return extractInsights(fullText); },
  get keywords() { return keywords(fullText, 8); },
  get tune() { return tune; },
  get events() { return events; },
  runDemo, switchLive, startRecording, stopRecording,
  setTune(patch) { Object.assign(tune, patch); },
};

boot();