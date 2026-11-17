// Whisper ASR via transformers.js — fully local (vendored model + WASM).
import { pipeline, env } from "../vendor/transformers.min.js";

env.allowRemoteModels = false;
env.localModelPath = "models/";
env.backends.onnx.wasm.wasmPaths = "vendor/ort/";
env.backends.onnx.wasm.numThreads = 1; // extension pages lack SharedArrayBuffer
env.backends.onnx.wasm.simd = true;
env.backends.onnx.logLevel = "error";

let transcriber = null;
let loadMs = 0;

export async function initASR(onProgress) {
  const t0 = performance.now();
  transcriber = await pipeline("automatic-speech-recognition", "Xenova/whisper-tiny.en", {
    quantized: true,
    progress_callback: (p) => { if (onProgress) onProgress(p); },
  });
  loadMs = performance.now() - t0;
  return true;
}

export function asrReady() { return !!transcriber; }
export function getLoadMs() { return loadMs; }

// audio: Float32Array 16kHz mono. Returns {text, chunks, ms}.
export async function transcribe(audio, { timestamps = false, chunkLength = 30 } = {}) {
  if (!transcriber) throw new Error("ASR not ready");
  const t0 = performance.now();
  const opts = { return_timestamps: timestamps };
  if (timestamps) { opts.chunk_length_s = chunkLength; opts.stride_length_s = 5; }
  const out = await transcriber(audio, opts);
  const ms = performance.now() - t0;
  const chunks = (out.chunks || []).map((c) => ({
    start: c.timestamp ? c.timestamp[0] : null,
    end: c.timestamp ? c.timestamp[1] : null,
    text: (c.text || "").trim(),
  })).filter((c) => c.text);
  return { text: (out.text || "").trim(), chunks, ms };
}