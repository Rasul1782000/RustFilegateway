//! Pure-Rust compression with a simple, real heuristic selector.
//!
//! The original spec proposed a Candle/ONNX model for "AI-powered" algorithm
//! selection. To keep the crate pure-Rust, dependency-light and actually
//! compiling, we use a deterministic heuristic based on data entropy instead.
//! The `select` function is the single place to plug in a learned model later.

use std::io::{Read, Write};

use crate::{GatewayConfig, GatewayError, GatewayResult};

/// Supported compression algorithms (all implemented in pure Rust).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CompressionType {
    /// lz4_flex — extremely fast, modest ratio.
    Lz4,
    /// flate2 (miniz_oxide) — good ratio, slower. Level 1-9.
    Deflate(i32),
    /// No compression (already incompressible or tiny).
    None,
}

/// Compression engine.
pub struct CompressionEngine {
    default_level: i32,
}

impl CompressionEngine {
    /// Create a new engine from the gateway configuration.
    pub fn new(config: &GatewayConfig) -> GatewayResult<Self> {
        Ok(Self {
            default_level: config.compression_level.clamp(1, 9),
        })
    }

    /// Choose a compression algorithm for `data`.
    ///
    /// Heuristic:
    /// * very small inputs are stored raw (not worth the overhead),
    /// * low-entropy data is stored raw (already repetitive),
    /// * high-entropy data uses Deflate for the best ratio,
    /// * everything in between uses fast LZ4.
    pub fn select(&self, data: &[u8]) -> CompressionType {
        if data.len() < 1024 {
            return CompressionType::None;
        }
        let e = entropy(data);
        if e < 2.5 {
            CompressionType::None
        } else if e > 7.5 {
            CompressionType::Deflate(self.default_level)
        } else {
            CompressionType::Lz4
        }
    }

    /// Compress `data` with the given algorithm.
    pub fn compress(&self, data: &[u8], ctype: CompressionType) -> GatewayResult<Vec<u8>> {
        match ctype {
            CompressionType::None => Ok(data.to_vec()),
            CompressionType::Lz4 => Ok(lz4_flex::compress_prepend_size(data)),
            CompressionType::Deflate(level) => {
                let mut encoder =
                    flate2::write::ZlibEncoder::new(Vec::new(), flate2::Compression::new(level as u32));
                encoder
                    .write_all(data)
                    .map_err(|e| GatewayError::Compression(e.to_string()))?;
                encoder
                    .finish()
                    .map_err(|e| GatewayError::Compression(e.to_string()))
            }
        }
    }

    /// Decompress `data` that was produced by [`CompressionEngine::compress`].
    pub fn decompress(&self, data: &[u8], ctype: CompressionType) -> GatewayResult<Vec<u8>> {
        match ctype {
            CompressionType::None => Ok(data.to_vec()),
            CompressionType::Lz4 => lz4_flex::decompress_size_prepended(data)
                .map_err(|e| GatewayError::Compression(e.to_string())),
            CompressionType::Deflate(_) => {
                let mut decoder = flate2::read::ZlibDecoder::new(data);
                let mut out = Vec::new();
                decoder
                    .read_to_end(&mut out)
                    .map_err(|e| GatewayError::Compression(e.to_string()))?;
                Ok(out)
            }
        }
    }
}

/// Shannon entropy of `data` in bits per byte (0..=8).
pub fn entropy(data: &[u8]) -> f64 {
    if data.is_empty() {
        return 0.0;
    }
    let mut counts = [0usize; 256];
    for &b in data {
        counts[b as usize] += 1;
    }
    let total = data.len() as f64;
    let mut e = 0.0;
    for &count in &counts {
        if count > 0 {
            let p = count as f64 / total;
            e -= p * p.log2();
        }
    }
    e
}
