// Audio helpers: decode any audio blob/file to 16kHz mono Float32Array (Whisper's input),
// plus a chunked microphone recorder. Everything stays on-device.

export async function decodeAndResample(arrayBuffer) {
  const AC = window.AudioContext || window.webkitAudioContext;
  const ctx = new AC();
  const buf = await ctx.decodeAudioData(arrayBuffer);
  await ctx.close();
  const targetRate = 16000;
  const dur = buf.duration;
  const frames = Math.max(1, Math.ceil(dur * targetRate));
  const off = new OfflineAudioContext(1, frames, targetRate);
  const src = off.createBufferSource();
  // downmix to mono by averaging channels
  if (buf.numberOfChannels > 1) {
    const mono = off.createBuffer(1, buf.length, buf.sampleRate);
    const out = mono.getChannelData(0);
    for (let ch = 0; ch < buf.numberOfChannels; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < d.length; i++) out[i] += d[i] / buf.numberOfChannels;
    }
    src.buffer = mono;
  } else {
    src.buffer = buf;
  }
  src.connect(off.destination);
  src.start(0);
  const rendered = await off.startRendering();
  return { audio: rendered.getChannelData(0), duration: dur };
}

export async function loadDemoAudio(url) {
  const res = await fetch(url);
  const ab = await res.arrayBuffer();
  return decodeAndResample(ab);
}

// Chunked mic recorder: emits a decoded 16k Float32Array every chunkMs.
export class MicRecorder {
  constructor() {
    this.stream = null; this.recorder = null; this.chunks = [];
    this.recording = false; this.chunkMs = 8000; this.onChunk = null; this.onEnded = null;
    this._timer = null; this._mime = "";
  }
  async start(chunkMs) {
    this.chunkMs = chunkMs || this.chunkMs;
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    this.stream.getAudioTracks()[0].addEventListener("ended", () => {
      this.stop();
      if (this.onEnded) this.onEnded("mic-ended");
    });
    const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus"
      : MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
    this._mime = mime;
    this.recording = true;
    this._cycle();
  }
  _cycle() {
    if (!this.recording || !this.stream) return;
    this.chunks = [];
    this.recorder = new MediaRecorder(this.stream, this._mime ? { mimeType: this._mime } : undefined);
    this.recorder.ondataavailable = (e) => { if (e.data && e.data.size) this.chunks.push(e.data); };
    this.recorder.onstop = async () => {
      const blob = new Blob(this.chunks, { type: this._mime || "audio/webm" });
      this.chunks = [];
      if (this.recording) this._cycle(); // start next chunk immediately
      if (blob.size > 0 && this.onChunk) {
        try {
          const ab = await blob.arrayBuffer();
          const { audio, duration } = await decodeAndResample(ab);
          this.onChunk(audio, duration);
        } catch (e) { /* decode hiccup — skip chunk */ }
      }
    };
    this.recorder.start();
    this._timer = setTimeout(() => {
      if (this.recorder && this.recorder.state === "recording") this.recorder.stop();
    }, this.chunkMs);
  }
  stop() {
    this.recording = false;
    clearTimeout(this._timer);
    if (this.recorder && this.recorder.state === "recording") {
      try { this.recorder.stop(); } catch {}
    }
    if (this.stream) for (const t of this.stream.getTracks()) t.stop();
    this.stream = null;
  }
}