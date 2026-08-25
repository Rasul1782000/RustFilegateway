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
