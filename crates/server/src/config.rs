//! Configuration loading for the server.
//!
//! Precedence: CLI flags override values loaded from an optional TOML file,
//! which in turn override built-in defaults.

use std::path::PathBuf;

use clap::Parser;
use file_gateway_core::GatewayConfig;
use serde::Deserialize;

/// Command-line arguments.
#[derive(Parser, Debug)]
#[command(name = "file-gateway-server", version, about = "Pure-Rust file gateway API")]
pub struct Cli {
    /// Path to an optional TOML configuration file.
    #[arg(long)]
    pub config: Option<PathBuf>,
    /// Directory where chunks and the metadata database are stored.
    #[arg(long)]
    pub storage_path: Option<PathBuf>,
    /// HTTP port to listen on.
    #[arg(long, default_value_t = 3000)]
    pub port: u16,
    /// Average FastCDC chunk size in bytes.
    #[arg(long)]
    pub chunk_size: Option<usize>,
    /// Default compression level (1-9).
    #[arg(long)]
    pub compression_level: Option<i32>,
}

#[derive(Debug, Deserialize)]
struct TomlConfig {
    storage_path: Option<String>,
    chunk_size: Option<usize>,
    compression_level: Option<i32>,
}

/// Build a [`GatewayConfig`] and the listen port from the CLI + optional file.
pub fn load_config() -> (GatewayConfig, u16) {
    let cli = Cli::parse();

    let mut config = if let Some(path) = &cli.config {
        match std::fs::read_to_string(path).ok().and_then(|s| toml::from_str::<TomlConfig>(&s).ok()) {
            Some(tc) => {
                let mut c = GatewayConfig::default();
                if let Some(p) = tc.storage_path {
                    c.storage_path = PathBuf::from(p);
                }
                if let Some(cs) = tc.chunk_size {
                    c.chunk_size = cs;
                }
                if let Some(lvl) = tc.compression_level {
                    c.compression_level = lvl;
                }
                c
            }
            None => GatewayConfig::default(),
        }
    } else {
        GatewayConfig::default()
    };

    if let Some(p) = cli.storage_path {
        config.storage_path = p;
    }
    if let Some(cs) = cli.chunk_size {
        config.chunk_size = cs;
    }
    if let Some(lvl) = cli.compression_level {
        config.compression_level = lvl;
    }

    (config, cli.port)
}
