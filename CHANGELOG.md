# Changelog

All notable changes to Project Haven are documented in this file, organized by development sprints.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.2.0] - Sprint 2: Cryptographic Storage & Bandit Engine (2026-10-07)

### Added
- **Argon2id Key Derivation (`haven-storage/crypto.rs`)**: Secure derivation of 256-bit master keys from user PIN/passkey and salt with memory-hard parameters.
- **Per-Record Crypto-Shredding (`haven-storage/crypto.rs`)**: Envelope encryption using AES-256-GCM. Each memory record has an ephemeral random data key wrapped by the master vault key; overwriting and zeroizing the wrapped key renders raw flash blocks permanently and mathematically unrecoverable.
- **Relational Storage Manager (`haven-storage/storage.rs`)**: SQLite/SQLCipher persistence for `sessions`, `actions`, `memory_items` (tripartite episodic/semantic/procedural store), and `technique_stats`.
- **Thompson Sampling Contextual Bandit (`haven-core/policy.rs`)**: Beta distribution sampling ($\theta \sim \text{Beta}(\alpha, \beta)$) per coaching mode and technique with a 10% ($\epsilon = 0.10$) exploration floor, Bayesian posterior updates based strictly on session checkout scores (1–5) and one-tap feedback, and user veto management.
- **Unit & Integration Test Suites**: Policy distribution tests, crypto-shredding unrecoverability tests, and end-to-end database integration tests.

---

## [0.1.0] - Sprint 1: Core Engine & Safety Guardian (2026-10-07)

### Added
- **Cargo Monorepo Scaffolding**: Initialized root workspace with `haven-core`, `haven-storage`, and `haven-infer`.
- **Deterministic 7-Phase State Machine (`haven-core/state_machine.rs`)**:
  - Linear flow enforcement: `Contract` $\rightarrow$ `CheckIn` $\rightarrow$ `Focus` $\rightarrow$ `Explore` $\rightarrow$ `Options` $\rightarrow$ `Commit` $\rightarrow$ `Close`.
  - Distress evaluation in CheckIn with automatic clamping to `Steady` mode.
  - Client-owned focus agenda gating.
  - Advice locking in Explore and Commit; advice unlocked only in Options upon explicit user request.
  - Action commitment confidence threshold ($\ge 8/10$) with forced action shrinkage if lower.
  - Session checkout score (1–5) capture.
- **Dual-Tier Safety Guardian (`haven-core/guardian.rs`)**:
  - Deterministic pre-inference regex filter detecting suicidal ideation, self-harm, domestic violence, and acute distress.
  - 100% bypass on Red tier with immediate halt of coaching, compassionate non-interrogative response, and verified regional emergency cards.
  - Deterministic post-inference audit engine enforcing empathetic reflection first, at most one open-ended question, advice locking, and scrubbing of clinical diagnoses and dependency/parasocial phrasing.
- **Verified Crisis Resources (`resources/crisis_packs/`)**:
  - JSON emergency packs for UK (999, 116 123), US (911, 988), EU (112), and Global Fallback loaded via `haven-core/crisis.rs`.
- **Test Suites**:
  - 16 unit and integration tests covering state transitions, action shrinkage, 100% crisis interception, and post-audit enforcement (`tests/state_machine_tests.rs`, `tests/guardian_tests.rs`).
