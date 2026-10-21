use axum::{body::Body, http::Request};
use http_body_util::BodyExt;
use tower::ServiceExt;

#[tokio::test]
async fn installed_ui_and_api_share_a_router_without_masking_missing_resources() {
    let directory = std::env::temp_dir().join(format!("picture-manager-ui-{}", std::process::id()));
    std::fs::create_dir_all(directory.join("assets")).unwrap();
    std::fs::write(
        directory.join("index.html"),
        "<!doctype html><html>Viewer</html>",
    )
    .unwrap();
    std::fs::write(directory.join("assets/app.js"), "console.log('viewer');").unwrap();
    let router = nas_picture_manager_axum::build_router_with_ui(&directory);
    for (path, status, mime, expected) in [
        ("/", 200, "text/html", "Viewer"),
        ("/assets/app.js", 200, "javascript", "console.log"),
        ("/health", 200, "application/json", "version"),
        ("/api/status", 200, "application/json", "online"),
        (
            "/api/missing",
            404,
            "application/json",
            "resource not found",
        ),
        (
            "/assets/missing.js",
            404,
            "application/json",
            "resource not found",
        ),
        (
            "/../nas-app.json",
            404,
            "application/json",
            "resource not found",
        ),
    ] {
        let response = router
            .clone()
            .oneshot(Request::builder().uri(path).body(Body::empty()).unwrap())
            .await
            .unwrap();
        assert_eq!(response.status().as_u16(), status, "{path}");
        let cache = response
            .headers()
            .get("cache-control")
            .map(|value| value.to_str().unwrap().to_owned());
        let expected_cache = match (path, status) {
            ("/", _) => Some("no-cache"),
            ("/assets/app.js", _) => Some("public, max-age=31536000, immutable"),
            _ => None,
        };
        assert_eq!(cache.as_deref(), expected_cache, "{path}");
        assert!(
            response.headers()["content-type"]
                .to_str()
                .unwrap()
                .contains(mime),
            "{path}"
        );
        let bytes = response.into_body().collect().await.unwrap().to_bytes();
        assert!(String::from_utf8_lossy(&bytes).contains(expected), "{path}");
    }
    std::fs::remove_dir_all(directory).unwrap();
}
