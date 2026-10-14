//! Routing table of the application: one place to see every served path.

use axum::{
    extract::Request,
    http::{header, HeaderValue, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
    routing::get,
    Json, Router,
};
use serde::Serialize;
use std::path::PathBuf;
use tower_http::services::ServeDir;

use crate::controllers;

/// Service state returned by the health check.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Health {
    pub status: &'static str,
    pub version: &'static str,
}

/// Body shared by every failed response.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct ApiError {
    pub error: String,
}

async fn health() -> Json<Health> {
    Json(Health {
        status: "ok",
        version: env!("CARGO_PKG_VERSION"),
    })
}

async fn not_found() -> impl IntoResponse {
    (
        StatusCode::NOT_FOUND,
        Json(ApiError {
            error: "resource not found".to_owned(),
        }),
    )
}

pub fn build_router() -> Router {
    Router::new()
        .route("/health", get(health))
        .nest("/api", controllers::routes())
        .fallback(not_found)
        .layer(axum::middleware::from_fn(security_headers))
}

/// The installed NAS binary serves its UI and API on the same listener.
/// Missing files remain 404s, including unknown API routes (no HTML fallback).
pub fn build_router_with_ui(directory: impl Into<PathBuf>) -> Router {
    build_router()
        .fallback_service(ServeDir::new(directory.into()).not_found_service(get(not_found)))
        .layer(axum::middleware::from_fn(security_headers))
}

async fn security_headers(request: Request, next: Next) -> Response {
    let path = request.uri().path().to_owned();
    let mut response = next.run(request).await;
    // The files of `assets/` carry a hash of their content in the name: the browser keeps them for
    // good. The page that names them is asked for again every time.
    let cache = if path.starts_with("/assets/") {
        Some("public, max-age=31536000, immutable")
    } else if path == "/" || path.ends_with(".html") {
        Some("no-cache")
    } else {
        None
    };
    let succeeded = response.status().is_success();
    let headers = response.headers_mut();
    if let Some(cache) = cache.filter(|_| succeeded) {
        headers.insert(header::CACHE_CONTROL, HeaderValue::from_static(cache));
    }
    headers.insert(
        header::X_CONTENT_TYPE_OPTIONS,
        HeaderValue::from_static("nosniff"),
    );
    headers.insert(
        header::REFERRER_POLICY,
        HeaderValue::from_static("no-referrer"),
    );
    headers.insert(header::CONTENT_SECURITY_POLICY, HeaderValue::from_static(
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'",
    ));
    response
}
