# Project Haven: Zero-Knowledge AI Coaching Companion

> **A sovereign, air-gapped, on-device AI life coach adhering strictly to International Coaching Federation (ICF) standards and Motivational Interviewing.**

[![Rust 1.80+](https://img.shields.io/badge/rust-1.80+-orange.svg)](https://www.rust-lang.org)
[![Vite PWA](https://img.shields.io/badge/pwa-React%2018%20+%20Vite-blue.svg)](https://vitejs.dev)
[![WebGPU](https://img.shields.io/badge/webgpu-WebLLM-emerald.svg)](https://webllm.mlc.ai)
[![Zero-Knowledge](https://img.shields.io/badge/privacy-Zero--Knowledge-teal.svg)](#)
[![Tests Passing](https://img.shields.io/badge/tests-37%20passed-brightgreen.svg)](#)

---

## 📖 Quick Links & Documentation

* **[Master System Walkthrough & Operational Guide](file:///d:/Documents/_MyStuff/Projects/haven-lifecoach/SYSTEM_WALKTHROUGH_AND_GUIDE.md)**: Exhaustive manual detailing how to run the system and explaining the function of every core subsystem.
* **[Human Verification & Acceptance Protocol](file:///d:/Documents/_MyStuff/Projects/haven-lifecoach/HUMAN_VERIFICATION_GUIDE.md)**: Interactive testing checklist to verify conversational empathy, safety firewalls, and stealth modes.
* **[Changelog](file:///d:/Documents/_MyStuff/Projects/haven-lifecoach/CHANGELOG.md)**: Chronological history of all development sprints (Sprints 1 through 5) with architectural rationale ("Why") and technical diffs ("What").
* **[Haven Agent Specification](file:///d:/Documents/_MyStuff/Projects/haven-lifecoach/HAVEN_AGENT_SPEC.md)**: Architectural baseline and non-negotiable operational constraints.

---

## 🚀 Running Haven Locally

### 1. Launch the Live Web Client (PWA)
```powershell
cd platforms/web
npm install
npm run dev
```
Open **`http://localhost:3000/`** in your browser.

### 2. Run All Automated Engine Tests
```powershell
$env:CARGO_INCREMENTAL = "0"
cargo test --workspace
```

---

## 🏛️ System Architecture Summary

Haven follows the **Thin Native Shell, Shared Rust Engine** pattern:

1. **`haven-core`**:
   - **7-Phase State Machine**: Governs conversations from Contract to Close. Enforces advice locking and action shrinkage ($<8/10$).
   - **Safety Guardian**: Dual-tier firewall intercepting 100% of crisis prompts with zero LLM inference, plus post-inference JSON scrubbing.
   - **Thompson Bandit**: Bayesian contextual bandit optimizing coaching techniques based strictly on user checkout benefit.
   - **Cross-Platform Bridges**: C-ABI and UniFFI exports for iOS/Android, and `wasm-bindgen` for web runtimes.
2. **`haven-storage`**:
   - **Argon2id + AES-256-GCM Envelope Encryption**: Unique data key per record.
   - **Instant Crypto-Shredding**: Zeroizing wrapped keys makes ciphertext permanently undecipherable.
   - **Cosine Vector Search**: Local semantic similarity retrieval over memory embeddings.
   - **$<1000\text{ms}$ Panic-Wipe**: Overwrites SQLite file headers with cryptographic noise.
3. **`haven-infer`**:
   - **Prompt Slot Assembler**: Injects context into strict ICF prompt templates.
   - **Self-Healing Orchestrator**: 5-tier pipeline with automated retry loops on audit failure.
4. **`platforms/web` (PWA Presentation Tier)**:
   - **Vanilla CSS Design System**: Obsidian/slate theme with glassmorphic cards and fluid typography.
   - **Llama-3.2-3B-Instruct (128k Context Window)**: In-browser WebGPU execution guaranteeing zero context loss.
   - **Stealth Suite**: Calculator disguise, plausible deniability Decoy Vault (`0000` PIN), and quiet mode.