use axum::{
    body::Body,
    http::{Request, StatusCode},
};
use http_body_util::BodyExt;
use tower::ServiceExt;

use nas_picture_manager_axum::build_router;

async fn get(path: &str) -> (StatusCode, serde_json::Value) {
    let response = build_router()
        .oneshot(
            Request::builder()
                .uri(path)
                .body(Body::empty())
                .expect("valid request"),
        )
        .await
        .expect("router response");

    let status = response.status();
    let body = response
        .into_body()
        .collect()
        .await
        .expect("response body")
        .to_bytes();

    (status, serde_json::from_slice(&body).expect("JSON body"))
}

#[tokio::test]
async fn health_reports_the_service_status_and_version() {
    let (status, body) = get("/health").await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["status"], "ok");
    assert_eq!(body["version"], env!("CARGO_PKG_VERSION"));
}

#[tokio::test]
async fn unknown_routes_answer_with_a_json_error() {
    let (status, body) = get("/missing").await;

    assert_eq!(status, StatusCode::NOT_FOUND);
    assert_eq!(body["error"], "resource not found");
}

#[tokio::test]
async fn the_mock_controller_answers_under_the_api_prefix() {
    let (status, body) = get("/api/status").await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["online"], true);
    assert_eq!(body["version"], env!("CARGO_PKG_VERSION"));
}
