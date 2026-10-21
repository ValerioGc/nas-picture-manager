//! HTTP transport for the shared image domain. No filesystem paths are accepted.
mod error;
mod handlers;
mod query;
mod work;
use crate::images::MAX_FILE_BYTES;
use axum::{
    extract::DefaultBodyLimit,
    routing::{get, post},
    Json, Router,
};
use serde::Serialize;
use std::sync::Arc;

#[derive(Serialize)]
struct Status {
    online: bool,
    version: &'static str,
}

async fn status() -> Json<Status> {
    Json(Status {
        online: true,
        version: env!("CARGO_PKG_VERSION"),
    })
}

pub fn routes() -> Router {
    let worker = Arc::new(work::ImageWorker::default());
    Router::new()
        .route("/status", get(status))
        .merge(image_routes(worker))
}

fn image_routes(worker: Arc<work::ImageWorker>) -> Router {
    Router::new()
        .route("/images/inspect", post(handlers::inspect))
        .route("/images/render", post(handlers::render))
        .route("/images/export", post(handlers::export))
        .route(
            "/images/export_annotated",
            post(handlers::export_annotated).layer(DefaultBodyLimit::max(MAX_FILE_BYTES * 2 + 4)),
        )
        .route(
            "/images/export_overlay",
            post(handlers::export_overlay).layer(DefaultBodyLimit::max(MAX_FILE_BYTES * 2 + 4)),
        )
        .layer(DefaultBodyLimit::max(MAX_FILE_BYTES))
        .layer(axum::middleware::from_fn_with_state(
            worker.clone(),
            work::admit,
        ))
        .with_state(worker)
}
