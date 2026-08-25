//! Deduplication engine.
//!
//! A chunk is considered a duplicate when its blake3 hash has already been
//! seen. The set of stored chunk hashes is persisted in a `redb` table and
//! cached in a lock-free `DashMap` for low-latency lookups.

use std::sync::Arc;

use dashmap::DashMap;
use redb::{Database, TableDefinition};

use crate::GatewayResult;

const CHUNK_TABLE: TableDefinition<&str, &[u8]> = TableDefinition::new("chunks");

/// Deduplication engine backed by a redb table and a `DashMap` hot cache.
pub struct DedupEngine {
    db: Arc<Database>,
    seen: Arc<DashMap<String, u64>>,
}

impl DedupEngine {
    /// Create a new engine sharing the gateway's redb database.
    pub fn new(db: Arc<Database>) -> GatewayResult<Self> {
        // Ensure the chunks table exists so read paths work before any write.
        let write = db.begin_write()?;
        {
            let _chunks = write.open_table(CHUNK_TABLE)?;
        }
        write.commit()?;
        Ok(Self {
            db,
            seen: Arc::new(DashMap::new()),
        })
    }

    /// Compute the blake3 hash of `data` as a hex string.
    pub fn hash(data: &[u8]) -> String {
        blake3::hash(data).to_hex().to_string()
    }

    /// Record that a chunk with `hash` has been encountered.
    ///
    /// Returns `(is_new, reference_count)`. `is_new` is `true` when this is the
    /// first time the chunk is seen (so the caller must store its bytes).
    pub fn record(&self, hash: &str) -> GatewayResult<(bool, u64)> {
        if let Some(mut entry) = self.seen.get_mut(hash) {
            *entry += 1;
            return Ok((false, *entry));
        }

        let read = self.db.begin_read()?;
        let exists = {
            let table = read.open_table(CHUNK_TABLE)?;
            table.get(hash)?.is_some()
        };

        if exists {
            self.seen.insert(hash.to_string(), 2);
            Ok((false, 2))
        } else {
            self.seen.insert(hash.to_string(), 1);
            Ok((true, 1))
        }
    }

    /// Persist the fact that a chunk's bytes are now stored.
    pub fn mark_stored(&self, hash: &str) -> GatewayResult<()> {
        let write = self.db.begin_write()?;
        {
            let mut table = write.open_table(CHUNK_TABLE)?;
            table.insert(hash, &[0u8][..])?;
        }
        write.commit()?;
        Ok(())
    }
}
