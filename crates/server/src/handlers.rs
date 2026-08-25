//! HTTP request handlers for the file gateway API.

use std::collections::HashMap;
use std::sync::Arc;

use axum::{
    extract::{Multipart, Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use file_gateway_core::Gateway;

/// Shared application state.
#[derive(Clone)]
pub struct AppState {
    pub gateway: Arc<Gateway>,
}

/// Serve a tiny landing page so `/` returns something useful.
pub async fn serve_index() -> Html {
    Html(
        "<!doctype html><html><head><meta charset=utf-8>\
<title>File Gateway</title></head><body>\
<h1>File Gateway v2.0</h1>\
<p>Pure-Rust file API. Endpoints:</p>\
<ul>\
<li>POST /api/upload (multipart)</li>\
<li>GET /api/files</li>\
<li>GET /api/files/:id</li>\
<li>DELETE /api/files/:id</li>\
<li>GET /api/search?q=...</li>\
<li>GET /api/stats</li>\
</ul></body></html>"
            .to_string(),
    )
}

/// Wrapper mirroring `axum::response::Html` without re-importing it everywhere.
pub struct Html(pub String);

impl IntoResponse for Html {
    fn into_response(self) -> axum::response::Response {
        ([(axum::http::header::CONTENT_TYPE, "text/html; charset=utf-8")], self.0).into_response()
    }
}

/// Handle a multipart upload, processing each file field.
pub async fn upload_file(
    State(state): State<AppState>,
    mut multipart: Multipart,
) -> impl IntoResponse {
    let mut processed: Vec<file_gateway_core::FileMetadata> = Vec::new();
    let mut errors: Vec<String> = Vec::new();

    loop {
        let field = match multipart.next_field().await {
            Ok(Some(f)) => f,
            Ok(None) => break,
            Err(e) => {
                errors.push(format!("multipart error: {e}"));
                break;
            }
        };

        let name = field
            .file_name()
            .map(|s| s.to_string())
            .unwrap_or_else(|| "unknown".to_string());

        match field.bytes().await {
            Ok(bytes) => {
                let tmp = std::env::temp_dir().join(format!("{}-{}", uuid::Uuid::new_v4(), name));
                if let Err(e) = tokio::fs::write(&tmp, &bytes).await {
                    errors.push(format!("{name}: write error {e}"));
                    continue;
                }
                match state.gateway.process_file(&tmp).await {
                    Ok(meta) => {
                        let _ = tokio::fs::remove_file(&tmp).await;
                        processed.push(meta);
                    }
                    Err(e) => {
                        let _ = tokio::fs::remove_file(&tmp).await;
                        errors.push(format!("{name}: {e}"));
                    }
                }
            }
            Err(e) => errors.push(format!("{name}: read error {e}")),
        }
    }

    Json(serde_json::json!({
        "success": errors.is_empty(),
        "processed": processed,
        "errors": errors,
    }))
    .into_response()
}

/// List all stored files.
pub async fn list_files(State(state): State<AppState>) -> impl IntoResponse {
    match state.gateway.list_files() {
        Ok(files) => Json(serde_json::json!({ "files": files })).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}

/// Fetch a single file record by id.
pub async fn get_file(State(state): State<AppState>, Path(id): Path<String>) -> impl IntoResponse {
    match state.gateway.get_file(&id) {
        Ok(Some(record)) => Json(record).into_response(),
        Ok(None) => (StatusCode::NOT_FOUND, "file not found").into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}

/// Delete a file record by id.
pub async fn delete_file(State(state): State<AppState>, Path(id): Path<String>) -> impl IntoResponse {
    match state.gateway.delete_file(&id) {
        Ok(true) => (StatusCode::OK, "deleted").into_response(),
        Ok(false) => (StatusCode::NOT_FOUND, "file not found").into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}

/// Search files by name/hash.
pub async fn search_files(
    State(state): State<AppState>,
    Query(params): Query<HashMap<String, String>>,
) -> impl IntoResponse {
    let q = params.get("q").map(|s| s.as_str()).unwrap_or("");
    match state.gateway.search(q) {
        Ok(files) => Json(serde_json::json!({ "results": files })).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}

/// Aggregate statistics.
pub async fn get_stats(State(state): State<AppState>) -> impl IntoResponse {
    match state.gateway.stats() {
        Ok((original, compressed, saved)) => {
            let files = state.gateway.list_files().unwrap_or_default();
            let compression_ratio = if original > 0 {
                (compressed as f64 / original as f64) * 100.0
            } else {
                0.0
            };
            let dedup_ratio = if original > 0 {
                (saved as f64 / original as f64) * 100.0
            } else {
                0.0
            };
            Json(serde_json::json!({
                "total_files": files.len(),
                "total_original": original,
                "total_compressed": compressed,
                "total_dedup_saved": saved,
                "compression_ratio": compression_ratio,
                "dedup_ratio": dedup_ratio,
            }))
            .into_response()
        }
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}
