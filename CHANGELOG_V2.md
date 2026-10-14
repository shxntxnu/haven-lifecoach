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

### Stage 2: Readiness-based flow controller (`feat(flow)`)
**Added** (`platforms/web/src/flow/`, pure logic, not wired into the UI until Stage 4)
- `phases.ts`: the phase table. One place defines how much a person must share before each phase can move on (`minTurns`, `minWords`) and which mode applies.
- `signals.ts`: small readers of a single message: word count, "I don't know"-style non-answers, explicit pacing intent ("I'm ready" / "not yet"), and advice requests.
- `controller.ts`: `decideTurn()` and `confirmCommitment()`. Given the current state and a message, they return the next state plus *what the reply should do* (`replyKind`), without mutating anything.

**Behaviour (fixes v1 problems 1 and 2 at the logic level)**
- A phase advances **only on a turn where the person shared something real**, or said they are ready. A bare "ok" can never push the conversation forward.
- Explore needs two substantive turns. The person can say "I'm ready" (or use a UI control) to move on sooner, and "not yet" always wins, even when the criteria are met.
- **Gentle re-ask ladder** for very short replies: re-ask, then offer a simpler way in, then offer a pause.
- **Advice gate:** asking for advice is declined outside Options and never counts as sharing; in Options an invitation unlocks 2-3 ideas.
- **Distress:** an amber signal clamps mode to Steady and holds back Options/Commit until the person has had two calm turns in a row.
- Commit is confirmed by `confirmCommitment()`: a step is required and confidence must be at least 8 (rule moved out of the UI, mirrors Rust).

### Stage 3: Prompt builder with rolling history (`feat(prompt)`)
**Added** (`platforms/web/src/prompt/`, pure functions, tested with 18 Vitest tests)
- `builder.ts`: slot-filling system prompt builder (`buildSystemPrompt`) and chat message packager (`buildMessages`).
  - Slots: persona, phase intent, active operating mode, session contract, focus topic, specific turn task (`ReplyKind`), strict coaching & safety rules, and corrective instruction on retries.
  - History windowing (`windowHistory`): keeps up to 16 turns / 8,000 characters, dropping the oldest turns first, preserving recent context so local models remember the conversation (resolves v1 problem 3).
  - Strict coaching rules in system prompt: exactly one open question or one clear instruction pointing to on-screen controls, advice locked unless in Options and invited by the person, Steady mode brevity.
  - Output contract: prompts the model for the JSON object schema expected and validated by the Guardian (`reflection`, `question`, `full_reply`, `risk_tier`).
- `builder.test.ts`: tests for slot rendering, advice locking/unlocking, Steady mode brevity instruction, retry correction prompts, history windowing, and speaker turn alternation.

**Verification**
- `npm test`: 133 tests pass across 4 test files.
- `npm run build`: zero TypeScript errors.

