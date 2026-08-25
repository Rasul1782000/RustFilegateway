//! Storage engine: chunk blobs on disk + file metadata in a redb table.

use std::path::PathBuf;
use std::sync::Arc;

use redb::{Database, ReadableTable, TableDefinition};
use serde::{Deserialize, Serialize};

use crate::{GatewayError, GatewayResult};

const FILE_TABLE: TableDefinition<&str, &[u8]> = TableDefinition::new("files");

/// Serializable record describing one processed file.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileRecord {
    /// Unique id.
    pub id: String,
    /// Original file name.
    pub name: String,
    /// Overall blake3 hash of the file.
    pub hash: String,
    /// Total bytes in the original file.
    pub original_size: u64,
    /// Total compressed bytes written for unique chunks.
    pub compressed_size: u64,
    /// Number of chunks.
    pub chunk_count: usize,
    /// Number of unique (stored) chunks.
    pub unique_chunks: usize,
    /// Bytes avoided thanks to deduplication.
    pub dedup_saved: u64,
    /// RFC3339 creation timestamp.
    pub created_at: String,
}

/// Storage engine owning the chunk directory and the metadata database.
pub struct StorageEngine {
    db: Arc<Database>,
    chunk_dir: PathBuf,
}

impl StorageEngine {
    /// Create a new engine, ensuring the chunk directory exists.
    pub fn new(db: Arc<Database>, storage_path: &PathBuf) -> GatewayResult<Self> {
        let chunk_dir = storage_path.join("chunks");
        std::fs::create_dir_all(&chunk_dir)?;
        // Ensure the metadata tables exist so read paths work before any write.
        let write = db.begin_write()?;
        {
            let _files = write.open_table(FILE_TABLE)?;
        }
        write.commit()?;
        Ok(Self { db, chunk_dir })
    }

    /// Absolute path of the stored chunk for `hash`.
    pub fn chunk_path(&self, hash: &str) -> PathBuf {
        self.chunk_dir.join(hash)
    }

    /// Persist a compressed chunk, skipping if it already exists on disk.
    pub fn store_chunk(&self, hash: &str, data: &[u8]) -> GatewayResult<()> {
        let path = self.chunk_path(hash);
        if !path.exists() {
            std::fs::write(&path, data)?;
        }
        Ok(())
    }

    /// Read a stored chunk back from disk.
    pub fn read_chunk(&self, hash: &str) -> GatewayResult<Vec<u8>> {
        let path = self.chunk_path(hash);
        if path.exists() {
            Ok(std::fs::read(&path)?)
        } else {
            Err(GatewayError::NotFound(hash.to_string()))
        }
    }

    /// Save (or replace) a file record.
    pub fn save_file_record(&self, record: &FileRecord) -> GatewayResult<()> {
        let bytes = serde_json::to_vec(record)?;
        let write = self.db.begin_write()?;
        {
            let mut table = write.open_table(FILE_TABLE)?;
            table.insert(record.id.as_str(), bytes.as_slice())?;
        }
        write.commit()?;
        Ok(())
    }

    /// List all stored file records.
    pub fn list_files(&self) -> GatewayResult<Vec<FileRecord>> {
        let read = self.db.begin_read()?;
        let table = read.open_table(FILE_TABLE)?;
        let mut out = Vec::new();
        for result in table.iter()? {
            let (_k, v) = result?;
            let record: FileRecord = serde_json::from_slice(v.value())?;
            out.push(record);
        }
        Ok(out)
    }

    /// Fetch a single file record by id.
    pub fn get_file(&self, id: &str) -> GatewayResult<Option<FileRecord>> {
        let read = self.db.begin_read()?;
        let table = read.open_table(FILE_TABLE)?;
        match table.get(id)? {
            Some(v) => Ok(Some(serde_json::from_slice(v.value())?)),
            None => Ok(None),
        }
    }

    /// Delete a file record by id. Returns `true` if a record was removed.
    pub fn delete_file(&self, id: &str) -> GatewayResult<bool> {
        let write = self.db.begin_write()?;
        let removed = {
            let mut table = write.open_table(FILE_TABLE)?;
            let opt = table.remove(id)?;
            let is_some = opt.is_some();
            drop(opt);
            is_some
        };
        write.commit()?;
        Ok(removed)
    }

    /// Aggregate (total_original, total_compressed, total_dedup_saved).
    pub fn stats(&self) -> GatewayResult<(u64, u64, u64)> {
        let files = self.list_files()?;
        let mut original = 0u64;
        let mut compressed = 0u64;
        let mut saved = 0u64;
        for f in &files {
            original += f.original_size;
            compressed += f.compressed_size;
            saved += f.dedup_saved;
        }
        Ok((original, compressed, saved))
    }

    /// Search file records by name or hash substring.
    pub fn search(&self, query: &str) -> GatewayResult<Vec<FileRecord>> {
        let files = self.list_files()?;
        Ok(crate::search::search_files(&files, query))
    }
}
