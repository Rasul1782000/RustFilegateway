//! File Gateway HTTP server entry point.

mod config;
mod handlers;

use std::net::SocketAddr;
use std::sync::Arc;

use axum::{routing::{delete, get, post}, Router};
use file_gateway_core::Gateway;
use tower_http::{cors::CorsLayer, trace::TraceLayer};
use tracing_subscriber::EnvFilter;

use crate::config::load_config;
use crate::handlers::{AppState, delete_file, download_file, get_file, get_stats, list_files, search_files, serve_index, upload_file};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| "file_gateway=debug,info".into()),
        )
        .init();

    let (config, port) = load_config();
    tracing::info!(
        "starting File Gateway v2.0 (storage={:?}, chunk_size={}, level={})",
        config.storage_path,
        config.chunk_size,
        config.compression_level
    );

    let gateway = Arc::new(Gateway::new(config).await?);
    let state = AppState { gateway };

    let app = Router::new()
        .route("/", get(serve_index))
        .route("/api/upload", post(upload_file))
        .route("/api/files", get(list_files))
        .route("/api/files/:id", get(get_file))
        .route("/api/files/:id", delete(delete_file))
        .route("/api/files/:id/download", get(download_file))
        .route("/api/search", get(search_files))
        .route("/api/stats", get(get_stats))
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    tracing::info!("listening on http://{addr}");
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
