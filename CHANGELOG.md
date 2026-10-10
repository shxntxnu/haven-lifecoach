# Changelog

All notable changes to Project Haven are documented in this file, organized by development sprints.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.5.0] - Sprint 5: Real On-Device WebGPU Inference, Vector Memory & Decoy Vault (2026-10-10)

### Context & Architectural Motivation ("Why")
Sprint 5 advances Project Haven from simulated dialogue into **real local neural inference, longitudinal vector memory, and coercive threat protection**:
1. **Neural Hardware Acceleration**: Moving from deterministic simulation to real local model execution requires executing quantized weights on-device without cloud egress. WebGPU gives client browsers direct access to hardware GPU shaders, enabling real-time token streaming for **`Llama-3.2-3B-Instruct` (128k context)** directly in device VRAM with zero external API calls.
2. **Longitudinal Semantic Retrieval**: As clients complete multiple sessions, episodic reflections and living semantic profiles expand. On-device vector similarity search allows retrieving the top-$k$ most contextually relevant past insights, values, and commitments to inject into prompt slots, preserving longitudinal context without token bloat.
3. **Plausible Deniability Under Duress**: For users in high-risk or coercive environments (e.g. shared devices or abusive relationships), hiding the app behind a calculator is insufficient if an adversary demands the PIN. The dual-PIN Decoy Vault provides sovereign privacy by unsealing an innocuous personal organizer when the secondary decoy PIN is entered.

### Added ("What Was Changed")

#### 1. On-Device Cosine Vector Similarity Search (`crates/haven-storage/src/storage.rs`, `schema.rs`, `tests/vector_search_tests.rs`)
- **Why**: Allows semantic retrieval of client values and past episodic themes to populate `PromptAssembler` slots without transmitting embeddings to any third party.
- **What**:
  - Added `embedding BLOB` to `memory_items` schema table.
  - Implemented `serialize_embedding` and `deserialize_embedding` for compact little-endian byte storage.
  - Implemented `cosine_similarity` for normalized vector dot-products.
  - Implemented `insert_memory_with_embedding` and `search_similar_memories(query_embedding, kind_filter, top_k)`.
  - Updated `crypto_shred_memory()` to zeroize vector embeddings on flash storage alongside body ciphertext and wrapped keys.
  - Added comprehensive integration test [`tests/vector_search_tests.rs`](file:///d:/Documents/_MyStuff/Projects/haven-lifecoach/crates/haven-storage/tests/vector_search_tests.rs) verifying semantic similarity rankings, top-$k$ truncation, kind filtering, and post-shred exclusion.

#### 2. In-Browser WebGPU WebLLM Engine (`platforms/web/src/webllm.ts`, `components/ModelProgressHUD.tsx`)
- **Why**: Enables client browsers to load and execute 4-bit quantized weights (`Llama-3.2-3B-Instruct`, `Llama-3.2-1B-Instruct`, `Phi-3.5-mini`) directly in device VRAM with real-time token streaming.
- **What**:
  - Integrated `@mlc-ai/web-llm` with WebGPU hardware availability detection.
  - Implemented `ModelProgressHUD` reporting download percentage, shader compilation, and VRAM caching status.
  - Implemented token streaming and ICF JSON turn parsing in `App.tsx` with graceful fallback to instant simulation.

#### 3. Plausible Deniability Decoy Vault (`platforms/web/src/components/VaultAuthModal.tsx`, `DecoyVaultView.tsx`)
- **Why**: Protects users from coerced disclosure by providing a secondary PIN that unseals an innocuous personal planner.
- **What**:
  - Implemented `VaultAuthModal` with dual-PIN recognition (Master PIN `1234` vs. Decoy PIN `0000`).
  - Implemented `DecoyVaultView` rendering a realistic routine task checklist and study notes planner with zero trace of coaching dialogue.
  - Added Lock Vault button to header allowing clients to secure their sanctuary at any moment.

---

## [0.4.0] - Sprint 4: Platform Bindings & PWA Presentation Tier (2026-10-10)

### Context & Architectural Motivation ("Why")
Project Haven requires transitioning from a headless command-line slice to production client tiers while strictly following the **"Thin Native Shell, Shared Rust Engine"** design principle:
1. **Zero-Knowledge Core Preservation**: Core domain governance (safety guardian firewalls, state machine transitions, contextual bandit policy, and Argon2id/AES-256-GCM envelope encryption) must never be rewritten in JavaScript or platform native languages. Instead, C-compatible FFI and WebAssembly (`wasm32-unknown-unknown`) bridges expose the single audited Rust engine directly to native operating systems and air-gapped web browsers.
2. **Context-Preserving Local Inference**: To deliver on Project Haven's promise of personalized, longitudinal growth without cloud surveillance, on-device models must not lose conversational context across multi-session contracts, agendas, and commitments. We establish a local model selection architecture centered on **Llama-3.2-3B-Instruct with a 128,000-token context window**, guaranteeing zero context truncation on modern consumer devices.
3. **Calm, High-Aesthetic Sanctuary**: Coaching clients require an environment that inspires confidence and calm. The presentation tier features a pure Vanilla CSS design system with an obsidian/slate dark theme, glassmorphic cards, fluid typography (Outfit / Inter), and responsive touch controls.
4. **Suffering in Silence / Stealth Suite**: For clients navigating sensitive personal or domestic situations, privacy from shoulder-surfing is essential. Sprint 4 delivers a fully functional Calculator disguise mode, a quiet mode toggle, and an instantaneous (&lt;1000ms) cryptographic panic-wipe trigger.

### Added ("What Was Changed")

#### 1. Cross-Platform C-ABI FFI Foreign Function Interface (`crates/haven-core/src/ffi.rs`, `tests/ffi_bindings_tests.rs`)
- **Why**: Bridges the compiled Rust engine to iOS (Swift) and Android (Kotlin) presentation shells via UniFFI/C-ABI foreign function boundaries without logic duplication.
- **What**:
  - Exported extern `"C"` bindings for session lifecycle (`haven_session_new`, `haven_session_advance`).
  - Implemented C-compatible Safety Guardian pre-scanning (`haven_guardian_pre_scan`) and post-inference audit verification (`haven_guardian_post_audit`).
  - Implemented contextual Thompson Bandit technique sampling (`haven_bandit_select_technique`) and posterior feedback recording (`haven_bandit_record_feedback`).
  - Added dedicated integration test suite [`tests/ffi_bindings_tests.rs`](file:///d:/Documents/_MyStuff/Projects/haven-lifecoach/tests/ffi_bindings_tests.rs) verifying memory safety, string marshaling, handle lifecycles, and panic-free FFI interop.

#### 2. WebAssembly Client Engine (`crates/haven-core/src/wasm.rs`)
- **Why**: Enables client web browsers to execute Haven domain logic directly on-device with zero server egress and complete cryptographic air-gapping.
- **What**:
  - Implemented `WasmHavenEngine`, `WasmSessionState`, and `WasmPreScanResult` using `wasm-bindgen` with JS-friendly serializable types.
  - Unit tests verifying browser-compatible state machine transitions and safety checks directly within `haven-core`.

#### 3. React 18 + Vite PWA Presentation Tier (`platforms/web/`)
- **Why**: Delivers a state-of-the-art, calm client application that translates ICF competencies, safety boundaries, and local on-device inference into an intuitive user experience.
- **What**:
  - **Pure Vanilla CSS Design System (`platforms/web/src/index.css`)**:
    - Deep obsidian/slate palette (`#080c14`, `#0d1524`, `#152238`) with calming teal/sage accents (`#14b8a6`, `#10b981`).
    - Glassmorphic panels with backdrop filters, subtle glowing borders, and fluid typography stack (Outfit / Inter).
    - Mobile-first, responsive touch viewport layout adhering to Apple web app standards.
  - **7-Phase ICF Journey Stepper (`platforms/web/src/components/PhaseTimeline.tsx`)**:
    - Visual stepper tracking progression from `Contract` through `Close`.
    - Dynamic operating mode badges (`Steady`, `Explore`, `Build`, `Perform`).
  - **Dialogue Thread (`platforms/web/src/components/DialogueFeed.tsx`)**:
    - Distinct visual presentation separating empathetic reflections from open coaching inquiries.
    - Technique attribution badge displaying active Thompson-sampled techniques.
  - **Action Formulation & Shrinkage Protocol (`platforms/web/src/components/ActionShrinkageModal.tsx`)**:
    - Interactive 0–10 confidence slider strictly gating actions under 8/10.
    - Automated action shrinkage guidance prompting micro-steps when confidence &lt; 8.
  - **Session Close & Checkout Scoring (`platforms/web/src/components/CheckoutModal.tsx`)**:
    - 1–5 checkout score rating and technique feedback updating the contextual bandit's Beta distribution.
  - **Context-Preserving Local Model Selector (`platforms/web/src/components/ModelSelector.tsx`)**:
    - Prominently features **Llama-3.2-3B-Instruct (128k Context Window — Recommended: Zero Context Loss)**.
    - Offers **Llama-3.2-1B-Instruct (128k Context)** for low-RAM mobile devices, **Phi-3.5-mini-instruct (128k Context)** for complex reasoning, and an instant **Air-Gapped Simulation Engine** for environments without WebGPU.
  - **Stealth Suite (`platforms/web/src/components/Header.tsx`, `CalculatorDisguise.tsx`)**:
    - *Quiet Mode*: Full suppression of system notifications and badging.
    - *Disguise Mode*: Instant toggle replacing Haven with a fully functional arithmetic calculator (with stealth unlock code `42=`).
    - *Panic-Wipe Gesture*: Instantaneous (&lt;1000ms) cryptographic destruction of in-memory dialogues and keys that immediately flips to the disguise view.
  - **Emergency Safety Overlay (`platforms/web/src/components/CrisisModal.tsx`)**:
    - 100% Red-tier pre-scan bypass displaying verified regional helplines (UK 111/999/Samaritans, US 988/Crisis Text Line, EU 112, Global) and halting all coaching dialogue.

---

## [0.3.0] - Sprint 3: Local Inference Engine & Offline Vertical Slice (2026-10-08)

### Context & Architectural Motivation ("Why")
Prior to building platform-specific user interfaces (iOS SwiftUI, Android Compose, Web PWA), the system requires proof that an end-to-end coaching dialogue can execute completely offline on consumer client hardware with zero server dependency, zero internet calls, and 100% adherence to International Coaching Federation (ICF) and Safety Guardian standards.

Sprint 3 achieves this critical integration milestone:
1. **Local Inference Abstraction**: Decoupling the conversational orchestrator from specific model weights, allowing local GGUF models (`llama.cpp`) and high-fidelity test simulations.
2. **Deterministic Context Slot Injection**: Restricting small on-device models to filling slots inside an ICF-compliant prompt and strictly constraining generation to a validated JSON schema.
3. **Headless Vertical Slice Prototype**: Validating the entire multi-crate loop (`haven-core` + `haven-storage` + `haven-infer`) in a single headless CLI integration test driving a complete 7-phase session.
4. **Adversarial & Crisis Red-Teaming**: Empirically proving 100.0% Red-tier crisis interception across 2,200+ synthetic prompts with zero cloud oversight.

### Added ("What Was Changed")

#### 1. ICF Prompt Assembly & JSON Schema Formatting (`crates/haven-infer/src/prompt.rs`)
- **Why**: Small on-device language models (1B–8B parameters) wander into open-ended chatter, diagnostic opinions, or unsolicited advice without structured scaffolding. Formatting turns into strict JSON matching post-audit regex filters guarantees compile-time and runtime compliance.
- **What**:
  - `PromptAssembler::build_prompt()` compiles active conversational slots:
    - Persona & non-clinical boundaries.
    - Active phase (`Contract` through `Close`), coaching mode (`Steady`, `Explore`, `Build`, `Perform`), and Thompson-sampled technique.
    - Client contract, focus agenda, decrypted semantic profile values, and retrieved past episodic summaries.
    - Injected operational ICF constraints: reflection first, at most 1 open question, advice locking.
    - Corrective instruction slot for self-healing retries upon audit violation.
    - Strict JSON output schema specification.

#### 2. Pluggable Inference Backend & Local Runtimes (`crates/haven-infer/src/backend.rs`, `llama_backend.rs`)
- **Why**: Real on-device GGUF models are 2–3 GB files. Continuous integration, unit testing, and automated developer harnesses require fast, deterministic execution without mandatory multithreaded weight downloads, while native handset targets require embedded `llama.cpp`.
- **What**:
  - `InferenceBackend` trait providing unified `generate(&self, prompt) -> Result<String, InferenceError>`.
  - `SimulatedCoachingBackend`: High-fidelity, offline test backend generating valid ICF turn payloads for all 7 phases, supporting configurable fault injection to verify error recovery.
  - `LlamaCppBackend`: Embedded runtime interface for quantized 1B–8B GGUF models loaded from local filesystem paths.

#### 3. End-to-End Coaching Session Orchestrator (`crates/haven-infer/src/orchestrator.rs`)
- **Why**: Coordinating state transitions, pre-inference scans, dynamic contextual bandit sampling, memory retrieval, model generation, post-audit checks, and encrypted persistence across independent crates requires a unified, self-healing pipeline.
- **What**:
  - Implemented `CoachingOrchestrator` integrating `Guardian`, `SessionStateMachine`, `ThompsonBandit`, `HavenStorage`, and `InferenceBackend`.
  - **Self-Healing Retry Loop**: If a model response fails post-inference audit (e.g. unsolicited advice or multiple questions), the orchestrator automatically injects corrective instructions and regenerates up to 3 times before falling back to a safe, non-judgmental reflection template.
  - Automated session persistence and posterior distribution weight updates on checkout.

#### 4. Headless Vertical Slice CLI Integration Test Harness (`tests/vertical_slice_cli.rs`)
- **Why**: The primary engineering deliverable of Phase 1 is a headless integration harness executing a full 10-minute coaching session offline with zero network connectivity.
- **What**:
  - Comprehensive integration test simulating a full client journey:
    - Contract: Transition from corporate finance to climate tech.
    - CheckIn: Energy gauge (6/10).
    - Focus: Core fear of leaving stable salary.
    - Explore: Values alignment and reality exploration; advice gate verified locked.
    - Options: Brainstorming; explicit user invitation unlocks advice gate (2–3 alternatives presented).
    - Commit: Overly ambitious action (confidence 5/10) rejected by confidence gate; action shrunk to manageable micro-step (confidence 9/10) and accepted.
    - Close: Session completed with checkout score 5/5.
  - Verified SQLite session and action persistence, envelope encryption of episodic turns, crypto-shredding unrecoverability, and Thompson bandit $\alpha$ parameter update.

#### 5. Red-Team Safety & Adversarial Evaluation Suite (`tests/redteam_safety_tests.rs`)
- **Why**: A zero-knowledge offline system cannot rely on cloud trust & safety teams. It must be empirically tested against acute crisis, diagnostic traps, and parasocial manipulation.
- **What**:
  - Tested **2,240 synthetic crisis prompt combinations** across varied sentence structures, preambles, and regional datasets (UK, US, EU, Global): **100.0% intercepted in Red tier** with zero LLM inference.
  - Tested adversarial diagnostic statements (*"you suffer from clinical depression"*, *"you are diagnosed with borderline personality disorder"*): 100% blocked and rejected.
  - Tested parasocial attachment attempts (*"I'm the only one who understands you"*): 100% blocked and rejected.
  - Verified orchestrator advice gate locks when users demand prescriptive advice during Explore phase.

---

## [0.2.0] - Sprint 2: Cryptographic Storage & Bandit Engine (2026-10-07)

### Context & Architectural Motivation ("Why")
In coercive domestic, workplace, or institutional environments, individuals suffering in silence need complete certainty that personal disclosures cannot be forensically recovered from handset storage. Furthermore, small local LLMs require hyper-personalization without central server tracking, ad analytics, or engagement-maximizing reward loops (streaks, gamification). 

Sprint 2 addresses these imperatives by establishing:
1. **Forensic Zero-Knowledge Persistence**: Memory-hard key derivation and per-record cryptographic deletion ensuring physical flash inspections reveal only unrecoverable ciphertext.
2. **Anti-Dependency Self-Evolution**: A Bayesian Thompson sampling bandit that personalizes coaching technique selection based strictly on user-reported benefit, never dwell time or retention.

### Added ("What Was Changed")

#### 1. Argon2id Master Key Derivation (`crates/haven-storage/src/crypto.rs`)
- **Why**: Standard passwords/PINs hashed with fast functions (SHA-256) or weak derivation are vulnerable to GPU brute-force recovery if a device database is exfiltrated.
- **What**:
  - Implemented `derive_master_key(pin, salt)` using Argon2id with memory-hard parameters ($m=65536\text{ KiB}, t=3\text{ passes}, p=1\text{ lane}$, 32-byte key).
  - Derived 256-bit key is wrapped in `MasterVaultKey` implementing `ZeroizeOnDrop`, ensuring plaintext master keys are aggressively wiped from RAM upon deallocation.

#### 2. Per-Record AES-256-GCM Envelope Encryption & Crypto-Shredding (`crates/haven-storage/src/crypto.rs`)
- **Why**: Flash storage media (NAND flash with wear-leveling) do not overwrite physical memory blocks when a SQLite row is deleted; deleted data remains accessible via chip-off forensic recovery. To provide genuine forensic deletion, each record must carry its own cryptographic lifecycle.
- **What**:
  - **Envelope Encryption**: Each memory record generates an ephemeral random 256-bit AES key (`record_key`) and random 96-bit nonce. The plaintext reflection is encrypted using AES-256-GCM.
  - **Key Wrapping**: The ephemeral `record_key` is encrypted (wrapped) with the user's `MasterVaultKey` using AES-256-GCM and stored in `record_key_wrapped`.
  - **Instant Crypto-Shredding**: When a user deletes a memory item, `crypto_shred_memory(id)` overwrites `record_key_wrapped` with 48 zeroes in SQLite storage. Without the unwrapped `record_key`, the ciphertext remaining on physical flash blocks is mathematically indecipherable noise. Subsequent decryption attempts fail definitively with `StorageError::RecordShredded`.

#### 3. Relational Storage Manager & Tripartite Memory (`crates/haven-storage/src/storage.rs`, `schema.rs`)
- **Why**: Human memory is multifaceted. Haven structures on-device memory into three distinct tiers to enable longitudinal continuity without mutating neural network weights.
- **What**:
  - Embedded SQLite storage engine with migrations for `sessions`, `memory_items`, `actions`, and `technique_stats`.
  - **Tripartite Memory Engine**:
    - *Episodic*: Session journals, key reflections, and takeaway commitments.
    - *Semantic*: Enduring client profile of values, strengths, themes, and relational boundaries.
    - *Procedural*: Technique effectiveness matrix and historical bandit weights.
  - **Stealth Suite Panic-Wipe**: Implemented single-call `panic_wipe()` which zeroizes in-memory master keys and scrambles the SQLite database header on disk with 4096 cryptographically random bytes within 1000ms.

#### 4. Thompson Sampling Contextual Bandit (`crates/haven-core/src/policy.rs`)
- **Why**: Commercial AI companions reward engagement, dwell time, and conversational volume—fostering unhealthy parasocial dependence. Haven operates under an anti-dependency reward function: it optimizes exclusively for client-reported self-efficacy and session clarity.
- **What**:
  - Multi-armed contextual bandit maintaining independent Beta distributions ($\theta_{m,t} \sim \text{Beta}(\alpha_{m,t}, \beta_{m,t})$) per coaching mode ($m \in \{\text{Steady}, \text{Explore}, \text{Build}, \text{Perform}\}$) and coaching technique ($t \in \mathcal{A}$).
  - Supported Techniques: `ValuesClarification`, `ScalingInquiry`, `StrengthsReframing`, `MicroStepBreakdown`, `PerspectiveShift`, `ExceptionSeeking`, `GroundingBreath`.
  - **Exploration Floor**: Configured $\epsilon = 0.10$. With 10% probability, selects uniform random technique; with 90% probability, exploits highest sampled $\theta$. Prevents getting trapped in local sub-optimal policies.
  - **Bayesian Posterior Updates**: Updated strictly via one-tap feedback ("That helped" $\implies +1 \alpha$; "Not quite" $\implies +1 \beta$) and session checkout ratings (scores $4..5 \implies +1 \alpha$; scores $1..2 \implies +1 \beta$; score $3$ is neutral).
  - **Technique Vetoing**: Users retain sovereign control to permanently blacklist techniques they dislike, completely removing them from candidate selection.

#### 5. Automated Verification Suites (`crates/haven-storage/tests/`, `haven-core/tests/`)
- Added `crypto_tests.rs`: Validates deterministic Argon2id derivation, wrong PIN rejection, envelope roundtrips, and crypto-shredding unrecoverability.
- Added `storage_integration_tests.rs`: Validates memory CRUD, shredding verification, session/action relational persistence, bandit technique sync, and panic-wipe header scrambling.
- Added `policy_tests.rs`: Validates Beta sampling distribution, posterior updates, convergence toward rewarded techniques, exploration floor guarantees, and veto enforcement.

---

## [0.1.0] - Sprint 1: Core Engine & Safety Guardian (2026-10-07)

### Context & Architectural Motivation ("Why")
Small local language models (1B–8B parameters) lack inherent moral reasoning and are prone to sycophancy, confabulation, premature advice-giving, and diagnostic overreach. In high-stakes emotional conversations, relying on the LLM's own prompt obedience is unsafe. 

Project Haven resolves this by implementing a **"Thin Native Shell, Heavy Shared Rust Engine"** architecture where conversational flow, ethical standards (ICF coaching compliance), and safety firewalls are enforced deterministically by Rust code before and after inference.

### Added ("What Was Changed")

#### 1. Cargo Monorepo Topology & Toolchain Setup
- **Why**: Client code (iOS SwiftUI, Android Compose, React PWA) must share identical, audited domain and safety logic without duplicating safety-critical code across Swift, Kotlin, and TypeScript.
- **What**:
  - Initialized root Cargo workspace with three member crates:
    - `crates/haven-core`: Pure domain logic, state machine, safety filters, contextual bandit.
    - `crates/haven-storage`: Zero-knowledge cryptographic persistence, SQLCipher/SQLite engine.
    - `crates/haven-infer`: Embedded model runtime abstraction layer (llama.cpp / WebLLM).
  - Bootstrapped Rust 1.99.0 toolchain with MinGW-w64 GNU compiler backend.

#### 2. Deterministic 7-Phase State Machine (`crates/haven-core/src/state_machine.rs`)
- **Why**: Real-world certified coaching (ICF) and Motivational Interviewing (OARS) require that the client sets the agenda, explores reality, and owns all action steps. Small models default to advice-giving and conversational drift. The state machine strictly governs the dialogue shape.
- **What**:
  - Implemented strict sequential graph transitions:
    `Contract` $\rightarrow$ `CheckIn` $\rightarrow$ `Focus` $\rightarrow$ `Explore` $\rightarrow$ `Options` $\rightarrow$ `Commit` $\rightarrow$ `Close`.
  - **State Invariants & Enforcements**:
    - *Contract*: Must establish session target before advancing.
    - *CheckIn Distress Auto-Clamp*: If distress or emotional fatigue is flagged, the session mode is automatically clamped to `Steady` (grounding reflections, maximum 3 sentences, zero action pressure).
    - *Client-Owned Focus Agenda*: In Focus, topic selection is 100% client-driven. Haven is programmatically prevented from choosing or prescribing topics.
    - *Advice Locking*: Advice generation is strictly locked in Explore and Commit. In Options, advice is locked unless the client explicitly requests ideas (`unlock_advice_by_user_request()`), and Haven must present 2–3 alternatives rather than a single prescriptive instruction.
    - *Action Confidence Gating & Shrinkage*: In Commit, actions are rated for confidence on a 0–10 scale. If confidence $< 8/10$, advancing to Close is hard-blocked (`ConfidenceTooLowForCommitment`). The client must shrink the action (`shrink_action()`) into an achievable micro-step before closing.
    - *Close*: Consolidates learnings and captures a 1–5 checkout score to feed procedural learning.

#### 3. Dual-Tier Safety Guardian (`crates/haven-core/src/guardian.rs`)
- **Why**: Because Haven is completely private and runs on-device without cloud telemetry, human dispatchers cannot intervene in emergencies. Safety must be enforced deterministically on the handset with zero false negatives on acute crisis.
- **What**:
  - **Dual-Tier Firewall Architecture**:
    - *Pre-Inference Scan (Deterministic Rule Engine)*: Evaluates raw user input with compiled regex sets before assembling prompts or invoking the LLM:
      - `Red Tier (Crisis/Self-Harm)`: Immediate 100% bypass of coaching. Halts session, outputs compassionate presence with zero interrogatives (questions), surfaces pre-authored user safety plans, and displays verified regional emergency cards.
      - `Amber Tier (Distress/Burnout)`: Clamps session mode to `Steady` and suppresses goal setting.
      - `Green Tier (Normal)`: Routes to coaching state machine.
    - *Post-Inference Audit (Deterministic JSON Inspector)*: Inspects LLM draft JSON response prior to rendering:
      - **Reflection Requirement**: Enforces empathetic reflection (emotional validation/summary) prior to any question.
      - **Single-Question Rule**: Permits at most ONE open-ended coaching question per turn, suppressing judgmental "why" interrogatives.
      - **Advice Gate Check**: Rejects and sanitizes turns that offer advice outside the Options phase.
      - **Clinical & Dependency Scrubbing**: Permanently suppresses diagnostic statements (*"you have clinical depression"*) and parasocial dependency phrases (*"I'm the only one who understands you"*).

#### 4. Verified Offline Crisis Packs (`crates/haven-core/src/crisis.rs`, `resources/crisis_packs/`)
- **Why**: Crisis intervention must function when the user has airplane mode on, poor cellular signal, or no internet connection.
- **What**:
  - Embedded country-specific crisis datasets compiled into the binary:
    - UK: 999 (Emergency), 116 123 (Samaritans), Shout 85258, NHS 111.
    - US: 911 (Emergency), 988 (Suicide & Crisis Lifeline), Crisis Text Line 741741.
    - EU: 112 (European Emergency Number), child helplines.
    - Global Fallback: Befrienders Worldwide and findahelpline.com directory.

#### 5. Safety & State Machine Test Suites (`crates/haven-core/tests/`)
- Added `state_machine_tests.rs`: Validates full 7-phase run, invalid transitions, check-in distress clamping, advice locking, action shrinkage, and checkout score bounds.
- Added `guardian_tests.rs`: Validates 100% interception of crisis prompts, amber distress handling, reflection presence, single question limits, unsolicited advice rejection, and clinical/dependency scrubbing.
