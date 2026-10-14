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

