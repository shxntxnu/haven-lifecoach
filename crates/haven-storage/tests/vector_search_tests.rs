//! Integration tests for Haven on-device vector similarity search
//! and crypto-shredding zeroization.

use haven_storage::crypto::derive_master_key;
use haven_storage::storage::{HavenStorage, MemoryKind};

#[test]
fn test_vector_similarity_search_and_retrieval() {
    let master_key = derive_master_key("master_pin_1234", b"vector_test_salt").unwrap();
    let storage = HavenStorage::open_in_memory(master_key).unwrap();

    // 1. Insert semantic profile memories with vector representations
    // Career/Climate theme: [1.0, 0.0, 0.0, 0.0]
    let m1_id = storage
        .insert_memory_with_embedding(
            MemoryKind::Semantic,
            "Values: Climate impact and environmental justice are central to career fulfillment.",
            &[1.0, 0.1, 0.0, 0.0],
            1.5,
        )
        .unwrap();

    // Work-life / Family theme: [0.0, 1.0, 0.0, 0.0]
    let _m2_id = storage
        .insert_memory_with_embedding(
            MemoryKind::Semantic,
            "Values: Deep presence with family; non-negotiable weekends.",
            &[0.0, 1.0, 0.1, 0.0],
            1.2,
        )
        .unwrap();

    // Creative/Writing theme: [0.0, 0.0, 1.0, 0.0]
    let _m3_id = storage
        .insert_memory_with_embedding(
            MemoryKind::Semantic,
            "Strength: Creative writing and philosophical contemplation.",
            &[0.0, 0.1, 1.0, 0.0],
            1.0,
        )
        .unwrap();

    // Episodic memory with climate theme
    let m4_id = storage
        .insert_memory_with_embedding(
            MemoryKind::Episodic,
            "Session 2 reflection: Discovered dread around corporate banking greenwashing.",
            &[0.9, 0.0, 0.0, 0.1],
            1.0,
        )
        .unwrap();

    // 2. Query with a vector aligned with climate/career: [1.0, 0.0, 0.0, 0.0]
    let query_climate = [1.0, 0.0, 0.0, 0.0];
    let results = storage
        .search_similar_memories(&query_climate, Some(MemoryKind::Semantic), 2)
        .unwrap();

    assert_eq!(results.len(), 2);
    // Highest ranked should be m1
    assert_eq!(results[0].0.id, m1_id);
    assert!(results[0].1 > 0.95, "Expected high cosine similarity for m1");

    // 3. Query without kind filter
    let all_results = storage
        .search_similar_memories(&query_climate, None, 2)
        .unwrap();
    assert_eq!(all_results.len(), 2);
    // Top 2 should be m1 (semantic) and m4 (episodic)
    let top_ids: Vec<_> = all_results.iter().map(|(m, _)| m.id).collect();
    assert!(top_ids.contains(&m1_id));
    assert!(top_ids.contains(&m4_id));

    // 4. Test Crypto-Shredding Zeroization
    // Shred m1
    storage.crypto_shred_memory(m1_id).unwrap();

    // Re-query: m1 should no longer appear in search results
    let post_shred_results = storage
        .search_similar_memories(&query_climate, Some(MemoryKind::Semantic), 2)
        .unwrap();
    for (item, _) in post_shred_results {
        assert_ne!(item.id, m1_id, "Shredded memory must never be returned");
    }
}
