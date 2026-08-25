//! Content-Defined Chunking (CDC) using FastCDC.

use crate::{GatewayConfig, GatewayResult};
use fastcdc::v2020;

/// A single chunk location within the source data.
#[derive(Debug, Clone)]
pub struct ChunkInfo {
    /// Byte offset of the chunk within the source data.
    pub offset: usize,
    /// Length of the chunk in bytes.
    pub length: usize,
}

/// Split `data` into content-defined chunks using FastCDC.
///
/// Chunk boundaries are determined by the data itself, so identical
/// regions of different files produce identical chunk hashes — this is what
/// makes cross-file deduplication possible.
pub fn chunk_file(data: &[u8], config: &GatewayConfig) -> GatewayResult<Vec<ChunkInfo>> {
    if data.is_empty() {
        return Ok(Vec::new());
    }

    let min = (config.chunk_size / 4).max(256);
    let avg = config.chunk_size;
    let max = config.chunk_size * 4;

    let mut out = Vec::new();
    let chunker = v2020::FastCDC::new(data, min, avg, max);
    for c in chunker {
        out.push(ChunkInfo {
            offset: c.offset,
            length: c.length,
        });
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_config(chunk_size: usize) -> GatewayConfig {
        GatewayConfig {
            chunk_size,
            ..Default::default()
        }
    }

    #[test]
    fn empty_data_returns_empty_chunks() {
        let config = test_config(1024);
        let chunks = chunk_file(&[], &config).unwrap();
        assert!(chunks.is_empty());
    }

    #[test]
    fn small_data_produces_one_chunk() {
        let config = test_config(1024);
        let data = b"hello world";
        let chunks = chunk_file(data, &config).unwrap();
        assert!(!chunks.is_empty());
        let total: usize = chunks.iter().map(|c| c.length).sum();
        assert_eq!(total, data.len());
    }

    #[test]
    fn large_data_produces_multiple_chunks() {
        let config = test_config(256);
        let data: Vec<u8> = (0..10000).map(|i| (i % 256) as u8).collect();
        let chunks = chunk_file(&data, &config).unwrap();
        assert!(chunks.len() > 1);
        let total: usize = chunks.iter().map(|c| c.length).sum();
        assert_eq!(total, data.len());
    }

    #[test]
    fn chunks_cover_entire_data_without_gaps() {
        let config = test_config(512);
        let data: Vec<u8> = (0..5000).map(|i| (i % 256) as u8).collect();
        let chunks = chunk_file(&data, &config).unwrap();
        assert!(chunks.len() > 1);
        for window in chunks.windows(2) {
            let end = window[0].offset + window[0].length;
            assert_eq!(end, window[1].offset, "gap or overlap between chunks");
        }
        let last = chunks.last().unwrap();
        assert_eq!(last.offset + last.length, data.len());
    }

    #[test]
    fn chunk_offsets_within_bounds() {
        let config = test_config(512);
        let data: Vec<u8> = (0..8000).map(|i| (i % 256) as u8).collect();
        let chunks = chunk_file(&data, &config).unwrap();
        for c in &chunks {
            assert!(c.offset < data.len());
            assert!(c.offset + c.length <= data.len());
        }
    }
}
