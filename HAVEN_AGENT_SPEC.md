# PROJECT HAVEN: TECHNICAL ARCHITECTURE & AGENT SPECIFICATION
**Version:** 1.0.0-PoC  
**Target Environment:** Google Antigravity IDE / Autonomous Agent Harness  
**Core Stack:** Rust (`haven-core`), SQLCipher, `llama.cpp` (GGUF), UniFFI / WASM, React / SwiftUI / Jetpack Compose  
**Architectural Baseline:** Zero-Knowledge, On-Device Inference, Self-Evolving Memory, ICF Coaching Compliance

---

## 1. EXECUTIVE SUMMARY & MISSION CONSTRAINTS

Haven is a private, self-evolving AI coaching companion designed for Web, iOS, and Android. It delivers coach-grade personal development and reflective support—especially for individuals suffering in silence—while maintaining strict, zero-knowledge confidentiality. 

### Non-Negotiable Operational Constraints:
1. **Zero-Knowledge Architecture:** No server ever receives, stores, or processes user plaintext, embeddings, or metadata. No accounts, no central telemetry, no ad SDKs, and no cloud LLM inference. All computation occurs within the client hardware boundary.
2. **Deterministic State-Machine Governance:** Small on-device models (1B–8B parameters) are prone to hallucination, sycophancy, and premature advice-giving. The coaching conversation shape is enforced by a deterministic Rust state machine; the LLM merely fills conversational slots.
3. **ICF Coaching Integrity:** Haven is a coach, not a clinician or therapist. It adheres to International Coaching Federation (ICF) standards and Motivational Interviewing (OARS). It reflects before questioning, asks at most one open question per turn, and strictly gates advice behind explicit user request.
4. **Anti-Dependency Reward Function:** The system's learning policy is rewarded exclusively on user-reported benefit (one-tap feedback and session check-out score), never on time spent, daily streaks, or retention metrics.

---

## 2. THE IMMEDIATE NEXT LOGICAL STEP: VERTICAL SLICE PROTOTYPE

The next immediate logical milestone is the **Phase 1 Vertical Slice (Weeks 1–4)**. Rather than building multi-platform UIs prematurely, the Antigravity agent must construct an end-to-end headless integration harness in Rust:
- **Scope:** A single-threaded/async CLI test harness executing a complete 10-minute 7-phase coaching session offline.
- **Components to Validate:**
  1. `haven-core`: Session state machine transition logic.
  2. `haven-storage`: SQLCipher database with Argon2id master key derivation and per-record crypto-shredding.
  3. `haven-guardian`: Deterministic pre-inference crisis classifier and post-generation audit filter.
  4. `haven-infer`: Local execution of a quantized 3B–4B GGUF model via embedded `llama.cpp`.
  5. `haven-policy`: Thompson sampling contextual bandit with Beta distribution updates.

---

## 3. SYSTEM ARCHITECTURE & REPOSITORY TOPOLOGY

### 3.1 Architecture Overview
The system follows a "Thin Native Shell, Shared Rust Engine" pattern:

```
+-----------------------------------------------------------------------------------+
|                            CLIENT PRESENTATION TIERS                              |
|         iOS (SwiftUI)     |     Android (Jetpack Compose)     |     Web (React PWA)|
+-----------------------------------------------------------------------------------+
                                          |
                         UniFFI (Native)  |  wasm-bindgen (Web)
                                          v
+-----------------------------------------------------------------------------------+
|                      HAVEN-CORE ENGINE (RUST TRUST BOUNDARY)                      |
|                                                                                   |
|  +--------------------+   +--------------------+   +---------------------------+  |
|  | Session State      |-->| Safety Guardian    |-->| Local Inference Pipeline  |  |
|  | Machine (GROW/ICF) |   | (Pre/Post Filters) |   | (llama.cpp / WebLLM)      |  |
|  +--------------------+   +--------------------+   +---------------------------+  |
|            |                                                     |                |
|            v                                                     v                |
|  +--------------------+                            +---------------------------+  |
|  | Adaptation Engine  |                            | Storage & Memory Engine   |  |
|  | (Thompson Bandit)  |                            | (SQLCipher + sqlite-vec)  |  |
|  +--------------------+                            +---------------------------+  |
|            ^                                                     ^                |
|            |                                                     |                |
|            +--------- Hardware Key Store (Secure Enclave / StrongBox / PRF) ------+  |
+-----------------------------------------------------------------------------------+
```

### 3.2 Monorepo Layout
```
haven/
├── Cargo.toml                       # Cargo workspace configuration
├── crates/
│   ├── haven-core/                  # Core domain logic, state machine & FFI
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs               # UniFFI / WASM export declarations
│   │       ├── state_machine.rs     # 7-phase coaching state machine
│   │       ├── guardian.rs          # Safety Guardian (regex, keywords, classifier)
│   │       ├── policy.rs            # Thompson-sampling contextual bandit
│   │       └── memory.rs            # Episodic, semantic, procedural coordinator
│   ├── haven-storage/               # SQLCipher & sqlite-vec engine
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── schema.rs            # Relational tables & vector indices
│   │       └── crypto.rs            # Argon2id, AES-256-GCM & key shredding
│   └── haven-infer/                 # Inference abstraction layer
│       ├── Cargo.toml
│       └── src/
│           ├── lib.rs
│           └── llama_backend.rs     # llama.cpp C++ binding wrapper
├── platforms/
│   ├── ios/                         # SwiftUI project consuming staticlib
│   ├── android/                     # Jetpack Compose consuming AAR/JNI
│   └── web/                         # React 18 + Vite PWA using WebGPU/WASM
├── resources/
│   ├── crisis_packs/                # Verified emergency contact JSON by country
│   └── prompt_templates/            # State-specific coaching instruction templates
└── tests/
    ├── redteam_safety/              # 500+ crisis and adversarial prompts
    └── bandit_simulation/           # Synthetic user convergence test suite
```

---

## 4. DETAILED COMPONENT SPECIFICATIONS

### 4.1 Session State Machine (Coaching Discipline)
The conversation strictly progresses through 7 sequential phases:
1. **CONTRACT:** Establishes session purpose: *"What would make our time today well spent?"*
2. **CHECK_IN:** Evaluates emotional temperature and energy. Reviews prior commitments gently. Suggests Steady mode if heightened distress is detected.
3. **FOCUS:** Client selects the core agenda item: *"Of everything alive for you, what matters most right now?"* Haven never dictates the topic.
4. **EXPLORE (Reality):** Deepens self-awareness using OARS (Open questions, Affirmations, Reflections, Summaries). Gated: absolutely no advice.
5. **OPTIONS:** Brainstorms avenues forward. Advice Gate: Haven cannot offer ideas unless explicitly invited by the user, and even then must present 2–3 alternatives.
6. **COMMIT (Will):** Sizing actions. Asks for a confidence rating (0–10). If score < 8, forces action shrinkage. Action is recorded in user's exact words.
7. **CLOSE:** Consolidates learning. Captures one-tap checkout score (1–5), which updates the procedural learning bandit.

### 4.2 Safety Guardian (Dual-Tier Interceptor)
- **Pre-Inference Scan:**
  - `Green (Normal):` Route to coaching orchestrator.
  - `Amber (Distress):` Lock mode to Steady, suppress action setting, inject safety plan and groundings.
  - `Red (Crisis/Self-Harm):` Immediate bypass. Stop coaching mode. Output compassionate crisis response, provide verified emergency contacts (UK: 116 123 / 999; US: 988; EU: 112), and offer local user-defined safety plan.
- **Post-Inference Audit:**
  - Regex and AST inspection on draft JSON response:
    - Verifies reflection is present prior to any question.
    - Confirms `advice_given == false` unless current state is `OPTIONS`.
    - Detects diagnostic terminology or dependency-forming phrasing (*"I missed you"*, *"Only I understand you"*).
    - If audit fails, regenerates with explicit corrective guidance.

### 4.3 Self-Evolving Engine & Bandit Mathematics
- **Tripartite Memory Engine:**
  - *Episodic:* Short structured records of past sessions (goals, key insights, actions, checkout score).
  - *Semantic:* Living profile of values, strengths, ongoing themes, and important relationships. Editable and reviewable by user.
  - *Procedural:* Matrix of technique effectiveness.
- **Thompson Sampling Algorithm:**
  - For each mode $m$ and technique $t$, maintains parameters $lpha_{m,t}, eta_{m,t} \ge 1$.
  - Exploration floor: $\epsilon = 0.10$.
  - Selection:
    $$	heta_{m,t} \sim 	ext{Beta}(lpha_{m,t}, eta_{m,t})$$
    $$t^* = egin{cases} 	ext{UniformRandom}(\mathcal{A}_{	ext{allowed}}), & 	ext{with prob } \epsilon \ rg\max_{t \in \mathcal{A}_{	ext{allowed}}} 	heta_{m,t}, & 	ext{with prob } 1 - \epsilon \end{cases}$$
  - Posterior Update:
    $$lpha_{m,t} \leftarrow lpha_{m,t} + \mathbb{I}(	ext{helped}), \quad eta_{m,t} \leftarrow eta_{m,t} + \mathbb{I}(
eg	ext{helped})$$

### 4.4 Cryptography & Stealth Features
- **SQLCipher Master Encryption:** AES-256-CBC/GCM with 256,000 PBKDF2 iterations or Argon2id key derivation.
- **Per-Record Crypto-Shredding:** Each memory record is encrypted with a distinct random AES-256 data key (`record_key`). This key is wrapped by the master vault key. To delete a memory item, its wrapped key is zeroized and overwritten, making the encrypted blob on flash storage unrecoverable even under forensic imaging.
- **Stealth Suite:**
  - *Quiet Mode:* Zero OS notifications or badges.
  - *Disguise & Decoy Vault:* Alternate launcher icon ("Calculator" or "Notes"). Secondary PIN opens an empty decoy database.
  - *Panic-Wipe:* Dedicated touch gesture securely clears hardware keys and overwrites the DB header within 1000ms.

---

## 5. REFERENCE IMPLEMENTATIONS & SCHEMAS

### 5.1 SQLCipher Database Schema
```sql
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    started_at INTEGER NOT NULL,
    completed_at INTEGER,
    mode TEXT NOT NULL CHECK(mode IN ('Steady', 'Explore', 'Build', 'Perform')),
    contract TEXT,
    summary TEXT,
    checkout_score INTEGER CHECK(checkout_score BETWEEN 1 AND 5)
);

CREATE TABLE IF NOT EXISTS memory_items (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL CHECK(kind IN ('episodic', 'semantic', 'procedural')),
    body TEXT NOT NULL,
    embedding BLOB,
    importance REAL DEFAULT 1.0,
    last_used INTEGER NOT NULL,
    record_key_wrapped BLOB NOT NULL,
    user_pinned INTEGER DEFAULT 0,
    user_hidden INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS actions (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    confidence INTEGER NOT NULL CHECK(confidence BETWEEN 0 AND 10),
    due_date INTEGER,
    status TEXT NOT NULL CHECK(status IN ('open', 'completed', 'released'))
);

CREATE TABLE IF NOT EXISTS technique_stats (
    mode TEXT NOT NULL,
    technique TEXT NOT NULL,
    alpha REAL NOT NULL DEFAULT 1.0,
    beta REAL NOT NULL DEFAULT 1.0,
    vetoed INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (mode, technique)
);
```

### 5.2 System Coaching Prompt Template
```
You are Haven, a compassionate, coach-grade personal development thinking partner.
You are NOT a therapist, you do NOT diagnose medical conditions, and you NEVER give unsolicited advice.
You operate strictly under International Coaching Federation (ICF) and Motivational Interviewing standards.

CURRENT PHASE: {phase}
ACTIVE MODE: {mode}
SELECTED TECHNIQUE: {technique}
USER PROFILE: {semantic_profile}
RETRIEVED EPISODES: {retrieved_episodes}
SESSION CONTRACT: {contract}

STRICT OPERATIONAL RULES:
1. Always start your response with an empathetic, non-judgmental REFLECTION of what the client felt or stated.
2. Ask at most ONE open-ended question (prefer 'what' or 'how'; avoid interrogative 'why').
3. DO NOT give solutions, opinions, or advice unless the user explicitly asks. If asked, provide 2-3 brief options and ask which resonates.
4. Never pressure the user to commit to an action. All actions must be originated and sized by the user.
5. In Steady mode, keep your response strictly under 3 sentences.
6. Return valid JSON adhering to the schema:
{
  "reflection": "Your initial empathetic reflection...",
  "response": "Your full response including single open question...",
  "reflection_present": true,
  "advice_given": false,
  "risk_tier": "green"
}
```

---

## 6. SPRINT EXECUTION ROADMAP FOR THE AGENT

### Sprint 1: Core Engine & State Machine (Days 1–7)
- [ ] Initialize Cargo workspace (`haven-core`, `haven-storage`, `haven-infer`).
- [ ] Implement `state_machine.rs` with state transition enums and transition validation tests.
- [ ] Implement `guardian.rs` deterministic regex and keyword rule-sets for UK/US/EU emergency detection.
- [ ] Create unit tests validating 100% interception of red-tier crisis prompts.

### Sprint 2: Cryptographic Storage & Bandit Engine (Days 8–14)
- [ ] Implement SQLCipher storage provider in `haven-storage` with migrations.
- [ ] Implement Argon2id key derivation and per-record wrapped key encryption in `crypto.rs`.
- [ ] Implement Thompson Sampling contextual bandit in `policy.rs` with Beta distribution sampling.
- [ ] Write integration test demonstrating crypto-shredding: deleting a record key renders ciphertext unreadable.

### Sprint 3: Local Inference & Vertical Slice Test Harness (Days 15–21)
- [ ] Link `haven-infer` to `llama.cpp` using static C-bindings.
- [ ] Download and verify 4-bit quantised test model (e.g., Llama-3.2-3B-Instruct GGUF).
- [ ] Construct `tests/vertical_slice_cli.rs`: Headless simulation executing a 7-step coaching session with zero internet connectivity.
- [ ] Verify that model output complies with JSON schema and passes Guardian post-audit.

### Sprint 4: Platform Bindings & PWA Scaffold (Days 22–28)
- [ ] Configure UniFFI bindings for iOS (Swift) and Android (Kotlin).
- [ ] Compile `haven-core` to `wasm32-unknown-unknown` with `wasm-bindgen`.
- [ ] Scaffold minimal React PWA with WebGPU inference harness to validate cross-platform core parity.
