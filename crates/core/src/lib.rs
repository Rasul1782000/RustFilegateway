//! File Gateway Core Engine
//!
//! High-performance, memory-safe file processing with content-defined
//! chunking (FastCDC), deduplication (blake3 + redb), and pure-Rust
//! compression (lz4_flex / flate2).
//!
//! This crate is 100% safe Rust (`#![forbid(unsafe_code)]`). It does not
//! rely on zstd/brotli (which wrap C code); instead it uses `lz4_flex`
//! (pure Rust) and `flate2`'s `rust_backend` (miniz_oxide, pure Rust) so the
//! "pure Rust" promise holds. See the project README for the trade-offs
//! versus the original aspirational spec.

#![forbid(unsafe_code)]
#![deny(missing_docs)]

pub mod chunking;
pub mod compression;
pub mod dedup;
pub mod search;
pub mod storage;
pub mod utils;

use std::path::PathBuf;
use std::sync::Arc;

use serde::{Deserialize, Serialize};
use thiserror::Error;

use crate::compression::CompressionEngine;
use crate::dedup::DedupEngine;
use crate::storage::StorageEngine;

/// Configuration for the gateway engine.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GatewayConfig {
    /// Directory where chunk files and the metadata database are stored.
    pub storage_path: PathBuf,
    /// Maximum file size accepted for processing (bytes).
    pub max_file_size: u64,
    /// Average target chunk size used by FastCDC (bytes).
    pub chunk_size: usize,
    /// Default compression level (1-9) passed to the Deflate backend.
    pub compression_level: i32,
    /// Whether deduplication is enabled.
    pub dedup_enabled: bool,
    /// Whether compression is enabled.
    pub compression_enabled: bool,
    /// Maximum number of concurrent operations.
    pub max_concurrent_ops: usize,
}

impl Default for GatewayConfig {
    fn default() -> Self {
        let max_concurrent = std::thread::available_parallelism()
            .map(|n| n.get())
            .unwrap_or(4);
        Self {
            storage_path: PathBuf::from("./storage"),
            max_file_size: 10 * 1024 * 1024 * 1024,
            chunk_size: 1024 * 1024,
            compression_level: 3,
            dedup_enabled: true,
            compression_enabled: true,
            max_concurrent_ops: max_concurrent,
        }
    }
}

/// Errors produced by the gateway engine.
#[derive(Error, Debug)]
pub enum GatewayError {
    /// Wrapper for standard I/O errors.
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    /// Error produced while compressing or decompressing data.
    #[error("Compression error: {0}")]
    Compression(String),
    /// Error produced by the deduplication engine.
    #[error("Deduplication error: {0}")]
    Dedup(String),
    /// Error produced while chunking data.
    #[error("Chunking error: {0}")]
    Chunking(String),
    /// Error produced by the storage engine or metadata database.
    #[error("Storage error: {0}")]
    Storage(String),
    /// Error produced while (de)serializing records.
    #[error("Serialization error: {0}")]
    Serialization(String),
    /// A requested entity was not found.
    #[error("Not found: {0}")]
    NotFound(String),
}

impl From<redb::Error> for GatewayError {
    fn from(e: redb::Error) -> Self {
        GatewayError::Storage(e.to_string())
    }
}

macro_rules! from_redb {
    ($t:ty) => {
        impl From<$t> for GatewayError {
            fn from(e: $t) -> Self {
                GatewayError::Storage(e.to_string())
            }
        }
    };
}
from_redb!(redb::StorageError);
from_redb!(redb::DatabaseError);
from_redb!(redb::TableError);
from_redb!(redb::CommitError);
from_redb!(redb::TransactionError);

impl From<serde_json::Error> for GatewayError {
    fn from(e: serde_json::Error) -> Self {
        GatewayError::Serialization(e.to_string())
    }
}

/// Convenience result alias.
pub type GatewayResult<T> = Result<T, GatewayError>;

/// Result of processing a single file.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileMetadata {
    /// Unique id assigned to the file record.
    pub id: String,
    /// Original file name.
    pub name: String,
    /// Overall blake3 hash of the file contents.
    pub hash: String,
    /// Total bytes in the original file.
    pub original_size: usize,
    /// Total compressed bytes actually written (unique chunks only).
    pub compressed_size: usize,
    /// Bytes that were not re-stored thanks to deduplication.
    pub dedup_saved: usize,
    /// Number of chunks the file was split into.
    pub chunk_count: usize,
    /// Number of chunks that were unique (stored).
    pub unique_chunks: usize,
    /// compressed_size / original_size as a percentage.
    pub compression_ratio: f64,
    /// dedup_saved / original_size as a percentage.
    pub dedup_ratio: f64,
    /// Time spent processing, in milliseconds.
    pub processing_time_ms: f64,
}

/// The high-level gateway that ties together chunking, deduplication,
/// compression and storage.
pub struct Gateway {
    config: GatewayConfig,
    dedup: DedupEngine,
    compression: CompressionEngine,
    storage: StorageEngine,
}

impl Gateway {
    /// Build a new gateway, opening (or creating) the metadata database.
    pub async fn new(config: GatewayConfig) -> GatewayResult<Self> {
        std::fs::create_dir_all(&config.storage_path)?;
        let db_path = config.storage_path.join("metadata.redb");
        let db = Arc::new(redb::Database::create(&db_path)?);

        let dedup = DedupEngine::new(db.clone())?;
        let compression = CompressionEngine::new(&config)?;
        let storage = StorageEngine::new(db.clone(), &config.storage_path)?;

        Ok(Self {
            config,
            dedup,
            compression,
            storage,
        })
    }

    /// Process a file on disk: chunk, deduplicate, compress and store.
    pub async fn process_file(&self, path: &PathBuf) -> GatewayResult<FileMetadata> {
        let start = std::time::Instant::now();
        let name = path
            .file_name()
            .and_then(|s| s.to_str())
            .unwrap_or("unknown")
            .to_string();

        let path_clone = path.clone();
        let bytes = tokio::task::spawn_blocking(move || std::fs::read(&path_clone))
            .await
            .map_err(|e| GatewayError::Io(std::io::Error::new(std::io::ErrorKind::Other, e)))??;
        let data: &[u8] = &bytes;

        if (data.len() as u64) > self.config.max_file_size {
            return Err(GatewayError::Chunking(format!(
                "file too large: {} bytes (max {})",
                data.len(),
                self.config.max_file_size
            )));
        }

        let file_hash = blake3::hash(data).to_hex().to_string();
        let id = uuid::Uuid::new_v4().to_string();

        let mut chunks = chunking::chunk_file(data, &self.config)?;
        if chunks.is_empty() && !data.is_empty() {
            chunks.push(chunking::ChunkInfo {
                offset: 0,
                length: data.len(),
            });
        }

        let mut original_size: u64 = 0;
        let mut compressed_size: u64 = 0;
        let mut dedup_saved: u64 = 0;
        let mut unique_chunks: usize = 0;
        let mut chunk_count: usize = 0;
        let mut chunk_hashes = Vec::with_capacity(chunks.len());
        let mut chunk_sizes = Vec::with_capacity(chunks.len());
        let mut chunk_compressions = Vec::with_capacity(chunks.len());

        for c in &chunks {
            let chunk_data = &data[c.offset..c.offset + c.length];
            let hash = dedup::DedupEngine::hash(chunk_data);
            let (is_new, _count) = self.dedup.record(&hash)?;

            chunk_count += 1;
            original_size += c.length as u64;
            chunk_sizes.push(c.length);

            if is_new {
                unique_chunks += 1;
                let ctype = self.compression.select(chunk_data);
                let compressed = self.compression.compress(chunk_data, ctype)?;
                self.storage.store_chunk(&hash, &compressed)?;
                self.dedup.mark_stored(&hash)?;
                compressed_size += compressed.len() as u64;
                chunk_compressions.push(match ctype {
                    compression::CompressionType::None => "none".to_string(),
                    compression::CompressionType::Lz4 => "lz4".to_string(),
                    compression::CompressionType::Deflate(_) => "deflate".to_string(),
                });
            } else {
                dedup_saved += c.length as u64;
                chunk_compressions.push("none".to_string());
            }
            chunk_hashes.push(hash);
        }

        let record = storage::FileRecord {
            id: id.clone(),
            name,
            hash: file_hash,
            original_size,
            compressed_size,
            chunk_count,
            unique_chunks,
            dedup_saved,
            created_at: chrono::Utc::now().to_rfc3339(),
            chunk_hashes,
            chunk_sizes,
            chunk_compressions,
        };
        self.storage.save_file_record(&record)?;

        let compression_ratio = if original_size > 0 {
            (compressed_size as f64 / original_size as f64) * 100.0
        } else {
            0.0
        };
        let dedup_ratio = if original_size > 0 {
            (dedup_saved as f64 / original_size as f64) * 100.0
        } else {
            0.0
        };

        Ok(FileMetadata {
            id,
            name: record.name,
            hash: record.hash,
            original_size: original_size as usize,
            compressed_size: compressed_size as usize,
            dedup_saved: dedup_saved as usize,
            chunk_count,
            unique_chunks,
            compression_ratio,
            dedup_ratio,
            processing_time_ms: start.elapsed().as_secs_f64() * 1000.0,
        })
    }

    /// Return all stored file records.
    pub fn list_files(&self) -> GatewayResult<Vec<storage::FileRecord>> {
        self.storage.list_files()
    }

    /// Search stored file records by name or hash substring.
    pub fn search(&self, query: &str) -> GatewayResult<Vec<storage::FileRecord>> {
        self.storage.search(query)
    }

    /// Fetch a single file record by id.
    pub fn get_file(&self, id: &str) -> GatewayResult<Option<storage::FileRecord>> {
        self.storage.get_file(id)
    }

    /// Delete a file record by id.
    pub fn delete_file(&self, id: &str) -> GatewayResult<bool> {
        self.storage.delete_file(id)
    }

    /// Return aggregate statistics across all stored files.
    pub fn stats(&self) -> GatewayResult<(u64, u64, u64)> {
        self.storage.stats()
    }

    /// Reassemble a file from its stored chunks and return the original bytes.
    pub fn reassemble_file(&self, id: &str) -> GatewayResult<Vec<u8>> {
        let record = self
            .storage
            .get_file(id)?
            .ok_or_else(|| GatewayError::NotFound(id.to_string()))?;
        self.storage.reassemble_file(&record)
    }
}
