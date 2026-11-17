# Suite Dokumen Operation — MeetingScribe

**Penerbit:** PT. Sainskerta Solusi Nusantara — software house & AI partner sejak 2013
**Aplikasi:** MeetingScribe — Local Whisper Meeting Transcription
**Kode aplikasi:** MSB · **Tanggal rilis:** 17 November 2026 · **Versi:** 1.0
**Klasifikasi:** Confidential · **Status:** Final Draft — Review Manajemen

> **Disclaimer:** Seluruh harga, target, proyeksi, SLA, dan ambang waktu di dalam suite ini berstatus **usulan — perlu validasi manajemen**. Angka kompetitor adalah snapshot publik per November 2026 dan dapat berubah. Analisis kepatuhan bersifat internal dan bukan nasihat hukum. Klaim fitur selalu dapat ditunjuk ke kode repo (`manifest.json`, `background.js`, `js/`, `models/`, `vendor/`).

## Struktur Suite (20 dokumen DOCX)

### 01 — Business Strategy (Divisi Produk & Komersial)
- [01-Business-Strategy/01-Business-Model-Canvas.docx](01-Business-Strategy/01-Business-Model-Canvas.docx) — SSN-MSB-BMC-01
- [01-Business-Strategy/02-ICP-dan-Segmentasi-Pasar.docx](01-Business-Strategy/02-ICP-dan-Segmentasi-Pasar.docx) — SSN-MSB-ICP-02
- [01-Business-Strategy/03-Analisis-Kompetitor.docx](01-Business-Strategy/03-Analisis-Kompetitor.docx) — SSN-MSB-CMP-03
- [01-Business-Strategy/04-Analisis-SWOT.docx](01-Business-Strategy/04-Analisis-SWOT.docx) — SSN-MSB-SWOT-04

### 02 — Sales (Divisi Penjualan)
- [02-Sales/05-Proposal-Penjualan-B2B-Enterprise.docx](02-Sales/05-Proposal-Penjualan-B2B-Enterprise.docx) — SSN-MSB-PRP-B2B-05
- [02-Sales/05-Proposal-Penjualan-B2C-Prosumer.docx](02-Sales/05-Proposal-Penjualan-B2C-Prosumer.docx) — SSN-MSB-PRP-B2C-05
- [02-Sales/06-Statement-of-Work.docx](02-Sales/06-Statement-of-Work.docx) — SSN-MSB-SOW-06
- [02-Sales/07-Pricing-dan-Packaging.docx](02-Sales/07-Pricing-dan-Packaging.docx) — SSN-MSB-PRC-07
- [02-Sales/08-Sales-Playbook-dan-Battlecard.docx](02-Sales/08-Sales-Playbook-dan-Battlecard.docx) — SSN-MSB-SPB-08
- [02-Sales/09-Product-Datasheet.docx](02-Sales/09-Product-Datasheet.docx) — SSN-MSB-DS-09

### 03 — Pre-Sales (Divisi Pre-Sales / Solution Engineering)
- [03-Pre-Sales/10-Discovery-Questionnaire.docx](03-Pre-Sales/10-Discovery-Questionnaire.docx) — SSN-MSB-DQ-10
- [03-Pre-Sales/11-Demo-Script-dan-PoC-Plan.docx](03-Pre-Sales/11-Demo-Script-dan-PoC-Plan.docx) — SSN-MSB-DSP-11
- [03-Pre-Sales/12-Technical-Proposal.docx](03-Pre-Sales/12-Technical-Proposal.docx) — SSN-MSB-TPP-12
- [03-Pre-Sales/13-ROI-dan-Business-Case.docx](03-Pre-Sales/13-ROI-dan-Business-Case.docx) — SSN-MSB-ROI-13

### 04 — IT Communication (Divisi Engineering & Keamanan Informasi)
- [04-IT-Communication/14-Arsitektur-Solusi.docx](04-IT-Communication/14-Arsitektur-Solusi.docx) — SSN-MSB-ARC-14
- [04-IT-Communication/15-Arsitektur-Keamanan-dan-Threat-Model.docx](04-IT-Communication/15-Arsitektur-Keamanan-dan-Threat-Model.docx) — SSN-MSB-SEC-15
- [04-IT-Communication/16-Privasi-Data-dan-Kepatuhan.docx](04-IT-Communication/16-Privasi-Data-dan-Kepatuhan.docx) — SSN-MSB-PRV-16

### 05 — Resilience & Operations (Divisi Operasional & Layanan)
- [05-Resilience-Operations/17-Business-Continuity-Plan.docx](05-Resilience-Operations/17-Business-Continuity-Plan.docx) — SSN-MSB-BCP-17
- [05-Resilience-Operations/18-Disaster-Recovery-Plan.docx](05-Resilience-Operations/18-Disaster-Recovery-Plan.docx) — SSN-MSB-DRP-18
- [05-Resilience-Operations/19-SOP-Insiden-dan-Breach-Response.docx](05-Resilience-Operations/19-SOP-Insiden-dan-Breach-Response.docx) — SSN-MSB-SOP-19
- [05-Resilience-Operations/20-SLA-dan-Model-Dukungan.docx](05-Resilience-Operations/20-SLA-dan-Model-Dukungan.docx) — SSN-MSB-SLA-20

## Fakta Kunci Aplikasi yang Menjadi Dasar Suite

- Ekstensi Chrome Manifest V3 v1.0.0; permission `storage` saja; CSP `script-src 'self' 'wasm-unsafe-eval'`; tanpa content script/tabCapture/offscreen/host permissions.
- ASR 100% on-device: Whisper `Xenova/whisper-tiny.en` kuantisasi ONNX (encoder ±9,7 MB + decoder merged ±29,3 MB; total `models/` 43 MB) via transformers.js 2.17.2 + ONNX Runtime WASM SIMD 1 thread (`env.allowRemoteModels = false`).
- Audio: `getUserMedia` (mic) → MediaRecorder webm/opus chunk 4–15 s → resample 16 kHz mono; demo rapat sintetis 27 s auto-transcribe saat dibuka.
- Insight rule-based: action items (owner/deadline chip), decisions, keywords; ekspor TXT/Markdown/JSON.
- Batasan jujur: English-only (`is_multilingual: false`), tanpa diarization, akurasi varian terkecil, transkrip volatil (RAM) sampai diekspor, belum di Chrome Web Store.

© 2026 PT. Sainskerta Solusi Nusantara · Gedung Graha Mampang Lt. 3, Jakarta Selatan · hello@sainskerta.id · +62 813-5988-3131 · sainskerta.net
