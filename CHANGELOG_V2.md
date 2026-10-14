# Haven v2 Changelog

All notable changes on the `haven-v2` branch are documented here. The v1 history remains in [`CHANGELOG.md`](CHANGELOG.md) and is not modified by v2 work.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased] - 2.0.0-alpha.1

### Context ("Why")
v1 proved the idea, but its conversation flow has structural problems:
1. The simulated coach advances a phase on every message, so people are rushed and can hit a dead end with no clear next step.
2. With a real local model the phase never advances at all.
3. The model receives only the latest message, so it cannot remember the chat.
4. Model replies are not checked against the Safety Guardian rules.
5. The web crisis scan is weaker than the Rust Guardian.

v2 focuses on **conversation flow**: the person sets the pace, every turn gives a clear next step, and every reply is audited.

### Planned (see `haven_v2_implementation_plan.md`)
- Stage 0: changelog, version bump, test tooling.
- Stage 1: Safety Guardian parity in the web app, with fixtures shared with Rust.
- Stage 2: readiness-based phase controller.
- Stage 3: prompt builder with rolling conversation history.
- Stage 4: unified turn pipeline with audit, retry and safe fallback.
- Stage 5: person-led pacing, clear next steps, more varied dialogue.
- Stage 6: v2 documentation and human verification guide.

### Added
- `haven-v2` branch created from `develop`.
- This changelog.

### Stage 0: Foundation (`chore(v2)`)
- Web package version set to `2.0.0-alpha.1` (it had drifted at `0.4.0` while the v1 changelog reached `0.6.0`).
- Added **Vitest** (`npm test`, `npm run test:watch`) and its config in `vite.config.ts`. Tests live next to the code as `src/**/*.test.ts`.
- `.tmp/` added to `.gitignore`.

### Stage 1: Safety Guardian parity (`feat(safety)`)
**Added**
- `platforms/web/src/safety/guardian.ts`: TypeScript port of the Rust Guardian (`preScan`, `auditTurn`) with the same patterns and check order. Pure functions, no React or I/O.
- **Shared fixtures** in `resources/safety_fixtures/` (`prescan.json`, `audit.json`). They are run by both `crates/haven-core/tests/safety_fixtures_tests.rs` (Rust) and `src/safety/guardian.test.ts` (Vitest), so the two implementations cannot drift apart silently.

**Changed (web)**
- `runPreScan` in `engine.ts` is now a thin adapter over the new guardian. The old substring scan is gone.

**Changed (Rust, `guardian.rs`) to reach parity and close gaps found while porting**
- Red tier now also catches generic `suicide` / `suicidal`, `self-harm`, `end my life`, `overdose` / `overdosing`, `slit/slash my wrists`, and `cut myself again / on purpose / open / deep`.
- Amber tier now also catches any `panic attack` (previously only "severe"), `can't breathe`, `hyperventilating`, `shaking uncontrollably`, `extreme distress`, `terrified`.
- **Curly apostrophes** (`can’t`, `I’m`), which phone keyboards produce, are normalised before matching in both pre-scan and audit. Previously `I can’t go on like this` and `I’m the only one who understands you` slipped past.

**Deliberate trade-offs**
- Ambiguous everyday phrases are **not** treated as crises: `take my life back`, `cut myself some slack`. They are pinned as `green` fixtures. (The Rust `regex` crate has no look-around, so only unambiguous forms are matched.)
- The v1 web scan treated any `cut myself` as a crisis. That false-positive on "cut myself some slack" is removed; unambiguous self-harm forms remain red.

**Verification**
- `cargo test --workspace`: all pass, including the red-team (2,240 prompts) and vertical-slice suites.
- `npm test`: 53 tests pass. `npm run build`: no TypeScript errors.

