//! Database schema definitions and migration scripts.

pub const CREATE_SESSIONS_TABLE: &str = r#"
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    started_at INTEGER NOT NULL,
    completed_at INTEGER,
    mode TEXT NOT NULL CHECK(mode IN ('Steady', 'Explore', 'Build', 'Perform')),
    contract TEXT,
    summary TEXT,
    checkout_score INTEGER CHECK(checkout_score BETWEEN 1 AND 5)
);
"#;

pub const CREATE_MEMORY_ITEMS_TABLE: &str = r#"
CREATE TABLE IF NOT EXISTS memory_items (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL CHECK(kind IN ('episodic', 'semantic', 'procedural')),
    body BLOB NOT NULL,
    embedding BLOB,
    nonce BLOB NOT NULL,
    record_key_wrapped BLOB NOT NULL,
    wrapped_key_nonce BLOB NOT NULL,
    importance REAL DEFAULT 1.0,
    last_used INTEGER NOT NULL,
    user_pinned INTEGER DEFAULT 0,
    user_hidden INTEGER DEFAULT 0,
    is_shredded INTEGER DEFAULT 0
);
"#;

pub const CREATE_ACTIONS_TABLE: &str = r#"
CREATE TABLE IF NOT EXISTS actions (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    confidence INTEGER NOT NULL CHECK(confidence BETWEEN 0 AND 10),
    due_date INTEGER,
    status TEXT NOT NULL CHECK(status IN ('open', 'completed', 'released'))
);
"#;

pub const CREATE_TECHNIQUE_STATS_TABLE: &str = r#"
CREATE TABLE IF NOT EXISTS technique_stats (
    mode TEXT NOT NULL,
    technique TEXT NOT NULL,
    alpha REAL NOT NULL DEFAULT 1.0,
    beta REAL NOT NULL DEFAULT 1.0,
    vetoed INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (mode, technique)
);
"#;

pub const ALL_MIGRATIONS: &[&str] = &[
    CREATE_SESSIONS_TABLE,
    CREATE_MEMORY_ITEMS_TABLE,
    CREATE_ACTIONS_TABLE,
    CREATE_TECHNIQUE_STATS_TABLE,
];
