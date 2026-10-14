use axum::{
    body::Body,
    http::{Request, StatusCode},
};
use http_body_util::BodyExt;
use tower::ServiceExt;

async fn inspect(bytes: Vec<u8>) -> (StatusCode, serde_json::Value) {
    let response = nas_picture_manager_axum::build_router()
        .oneshot(
            Request::post("/api/images/inspect")
                .header("content-type", "application/octet-stream")
                .body(Body::from(bytes))
                .expect("request"),
        )
        .await
        .expect("response");
    let status = response.status();
    let body = response
        .into_body()
        .collect()
        .await
        .expect("body")
        .to_bytes();
    (status, serde_json::from_slice(&body).expect("JSON"))
}

#[tokio::test]
async fn inspects_an_uploaded_image() {
    let (status, body) = inspect(FIXTURE.to_vec()).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["info"]["format"], "PNG");
    assert!(body["info"]["width"]
        .as_u64()
        .is_some_and(|width| width > 0));
    assert!(body["preview"].is_array());
    assert!(body["info"]["folder"].is_null());
}

#[tokio::test]
async fn reports_the_specific_image_dimension_limit() {
    // Minimal BMP header; dimensions are checked before reading its pixel data.
    let mut bytes = vec![0; 58];
    bytes[..2].copy_from_slice(b"BM");
    bytes[2..6].copy_from_slice(&58_u32.to_le_bytes());
    bytes[10..14].copy_from_slice(&54_u32.to_le_bytes());
    bytes[14..18].copy_from_slice(&40_u32.to_le_bytes());
    bytes[26..28].copy_from_slice(&1_u16.to_le_bytes());
    bytes[28..30].copy_from_slice(&24_u16.to_le_bytes());
    for (width, height, expected) in [
        (10_001_i32, 10_000_i32, "pixel_limit_exceeded"),
        (16_385, 1, "dimension_limit_exceeded"),
    ] {
        bytes[18..22].copy_from_slice(&width.to_le_bytes());
        bytes[22..26].copy_from_slice(&height.to_le_bytes());
        let (status, body) = inspect(bytes.clone()).await;
        assert_eq!(status, StatusCode::PAYLOAD_TOO_LARGE);
        assert_eq!(body["error"], expected);
    }
}

#[tokio::test]
async fn rejects_malformed_and_oversized_content_with_typed_errors() {
    let (status, body) = inspect(b"/etc/passwd".to_vec()).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(body["error"], "unsupported_format");
    let (status, body) = inspect(vec![
        0;
        nas_picture_manager_axum::images::MAX_FILE_BYTES + 1
    ])
    .await;
    assert_eq!(status, StatusCode::PAYLOAD_TOO_LARGE);
    assert_eq!(body["error"], "file_too_large");
}

async fn post(path: &str, bytes: Vec<u8>) -> (StatusCode, axum::http::HeaderMap, Vec<u8>) {
    let response = nas_picture_manager_axum::build_router()
        .oneshot(
            Request::post(path)
                .header("content-type", "application/octet-stream")
                .body(Body::from(bytes))
                .expect("request"),
        )
        .await
        .expect("response");
    let status = response.status();
    let headers = response.headers().clone();
    let body = response
        .into_body()
        .collect()
        .await
        .expect("body")
        .to_bytes()
        .to_vec();
    (status, headers, body)
}
const FIXTURE: &[u8] = include_bytes!("../../../../src/tests/e2e/fixtures/colors.png");

#[tokio::test]
async fn renders_combined_edits_and_exports_all_formats() {
    let edits="rotation=1&flipHorizontal=true&brightness=10&contrast=-20&sharpness=40&cropX=2&cropY=3&cropWidth=10&cropHeight=20";
    let (status, _, bytes) = post(&format!("/api/images/render?{edits}"), FIXTURE.to_vec()).await;
    assert_eq!(status, StatusCode::OK);
    let document: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(document["info"]["width"], 10);
    assert_eq!(document["info"]["height"], 20);
    for (format, mime) in [
        ("png", "image/png"),
        ("jpeg", "image/jpeg"),
        ("webp", "image/webp"),
        ("gif", "image/gif"),
        ("bmp", "image/bmp"),
        ("tiff", "image/tiff"),
        ("ico", "image/x-icon"),
    ] {
        let (status, headers, bytes) = post(
            &format!("/api/images/export?{edits}&format={format}"),
            FIXTURE.to_vec(),
        )
        .await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(headers["content-type"], mime);
        assert_eq!(headers["cache-control"], "no-store");
        let reopened = nas_picture_manager_axum::images::read_bytes("copy.image", &bytes).unwrap();
        assert_eq!((reopened.info.width, reopened.info.height), (10, 20));
    }
}

#[tokio::test]
async fn malformed_edit_parameters_always_return_typed_errors() {
    for query in [
        "rotation=4",
        "rotation=-1",
        "rotation=abc",
        "brightness=101",
        "contrast=-101",
        "sharpness=255",
        "cropX=1",
        "cropX=0&cropY=0&cropWidth=0&cropHeight=1",
        "cropX=4294967295&cropY=0&cropWidth=2&cropHeight=1",
        "format=svg",
        "path=/etc/passwd",
    ] {
        for endpoint in ["render", "export"] {
            let (status, _, bytes) =
                post(&format!("/api/images/{endpoint}?{query}"), FIXTURE.to_vec()).await;
            assert_eq!(status, StatusCode::BAD_REQUEST, "{query}");
            let body: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
            assert_eq!(body["error"], "invalid_edits");
            assert!(!String::from_utf8_lossy(&bytes).contains("/etc"));
        }
    }
}

#[tokio::test]
async fn editing_endpoints_reject_invalid_and_oversized_payloads() {
    for endpoint in ["render", "export"] {
        let (status, _, bytes) =
            post(&format!("/api/images/{endpoint}"), b"invalid".to_vec()).await;
        assert_eq!(status, StatusCode::BAD_REQUEST);
        assert_eq!(
            serde_json::from_slice::<serde_json::Value>(&bytes).unwrap()["error"],
            "unsupported_format"
        );
        let (status, _, bytes) = post(
            &format!("/api/images/{endpoint}"),
            vec![0; nas_picture_manager_axum::images::MAX_FILE_BYTES + 1],
        )
        .await;
        assert_eq!(status, StatusCode::PAYLOAD_TOO_LARGE);
        assert_eq!(
            serde_json::from_slice::<serde_json::Value>(&bytes).unwrap()["error"],
            "file_too_large"
        );
    }
}

fn annotated_body(source: &[u8], annotations: &[u8]) -> Vec<u8> {
    let mut bytes = (source.len() as u32).to_le_bytes().to_vec();
    bytes.extend_from_slice(source);
    bytes.extend_from_slice(annotations);
    bytes
}

#[tokio::test]
async fn exports_annotated_images_and_validates_the_binary_envelope() {
    for (format, mime) in [
        ("png", "image/png"),
        ("jpeg", "image/jpeg"),
        ("webp", "image/webp"),
        ("gif", "image/gif"),
        ("bmp", "image/bmp"),
        ("tiff", "image/tiff"),
        ("ico", "image/x-icon"),
    ] {
        let (status, headers, bytes) = post(
            &format!("/api/images/export_annotated?format={format}&rotation=1"),
            annotated_body(FIXTURE, FIXTURE),
        )
        .await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(headers["content-type"], mime);
        let reopened = nas_picture_manager_axum::images::read_bytes("copy.image", &bytes).unwrap();
        assert_eq!((reopened.info.width, reopened.info.height), (48, 64));
    }
    for bytes in [
        vec![],
        vec![0; 4],
        u32::MAX.to_le_bytes().to_vec(),
        vec![10, 0, 0, 0],
        annotated_body(FIXTURE, &[]),
    ] {
        let (status, _, bytes) = post("/api/images/export_annotated", bytes).await;
        assert_eq!(status, StatusCode::BAD_REQUEST);
        assert_eq!(
            serde_json::from_slice::<serde_json::Value>(&bytes).unwrap()["error"],
            "invalid_input"
        );
    }
    let (status, _, _) = post(
        "/api/images/export_annotated?rotation=4",
        annotated_body(FIXTURE, FIXTURE),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    let (status, _, _) = post(
        "/api/images/export_annotated",
        annotated_body(FIXTURE, b"not an image"),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    let (status, _, bytes) = post(
        "/api/images/export_annotated",
        annotated_body(
            FIXTURE,
            &vec![0; nas_picture_manager_axum::images::MAX_FILE_BYTES + 1],
        ),
    )
    .await;
    assert_eq!(status, StatusCode::PAYLOAD_TOO_LARGE);
    assert_eq!(
        serde_json::from_slice::<serde_json::Value>(&bytes).unwrap()["error"],
        "file_too_large"
    );
    let (status, _, _) = post(
        "/api/images/export_annotated",
        vec![0; nas_picture_manager_axum::images::MAX_FILE_BYTES * 2 + 5],
    )
    .await;
    assert_eq!(status, StatusCode::PAYLOAD_TOO_LARGE);
}

#[tokio::test]
async fn binary_previews_contain_metadata_and_the_original_png_bytes() {
    let response = nas_picture_manager_axum::build_router()
        .oneshot(
            Request::post("/api/images/inspect")
                .header("content-type", "application/octet-stream")
                .header("accept", "application/vnd.picture-manager.image")
                .body(Body::from(FIXTURE))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(
        response.headers()["content-type"],
        "application/vnd.picture-manager.image"
    );
    assert_eq!(response.headers()["cache-control"], "no-store");
    assert_eq!(response.headers()["x-content-type-options"], "nosniff");
    let bytes = response.into_body().collect().await.unwrap().to_bytes();
    let length = u32::from_le_bytes(bytes[..4].try_into().unwrap()) as usize;
    let info: serde_json::Value = serde_json::from_slice(&bytes[4..4 + length]).unwrap();
    assert_eq!(info["width"], 64);
    let png = image_preview(FIXTURE);
    assert_eq!(&bytes[4 + length..], png);
}

fn image_preview(bytes: &[u8]) -> Vec<u8> {
    nas_picture_manager_axum::images::read_bytes("fixture.png", bytes)
        .unwrap()
        .preview
}

#[tokio::test]
async fn rejects_incompatible_content_types_and_cross_site_uploads() {
    for (mime, site) in [
        ("text/plain", "same-origin"),
        ("application/json", "same-origin"),
        ("application/octet-stream", "cross-site"),
    ] {
        let response = nas_picture_manager_axum::build_router()
            .oneshot(
                Request::post("/api/images/inspect")
                    .header("content-type", mime)
                    .header("sec-fetch-site", site)
                    .body(Body::from(FIXTURE))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
        let bytes = response.into_body().collect().await.unwrap().to_bytes();
        assert_eq!(
            serde_json::from_slice::<serde_json::Value>(&bytes).unwrap()["error"],
            "invalid_input"
        );
    }
}

#[tokio::test]
async fn holds_admission_until_response_buffers_are_consumed_and_rejects_before_reading() {
    let router = nas_picture_manager_axum::build_router();
    let request = || {
        Request::post("/api/images/inspect")
            .header("content-type", "application/octet-stream")
            .body(Body::from(FIXTURE))
            .unwrap()
    };
    let first = router.clone().oneshot(request()).await.unwrap();
    assert_eq!(first.status(), StatusCode::OK);
    let never_read = http_body_util::Full::new(axum::body::Bytes::from_static(b"untrusted"))
        .map_frame(|_| panic!("a busy request must not buffer its body"));
    let busy = router
        .clone()
        .oneshot(
            Request::post("/api/images/inspect")
                .header("content-type", "application/octet-stream")
                .body(Body::new(never_read))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(busy.status(), StatusCode::SERVICE_UNAVAILABLE);
    let bytes = busy.into_body().collect().await.unwrap().to_bytes();
    assert_eq!(
        serde_json::from_slice::<serde_json::Value>(&bytes).unwrap()["error"],
        "busy"
    );
    drop(first);
    assert_eq!(
        router.oneshot(request()).await.unwrap().status(),
        StatusCode::OK
    );
}

#[tokio::test]
async fn exports_an_overlay_in_final_coordinates_and_rejects_wrong_dimensions() {
    let edits = nas_picture_manager_axum::images::ImageEdits {
        rotation: 1,
        crop: Some(nas_picture_manager_axum::images::CropRectangle {
            x: 1,
            y: 2,
            width: 10,
            height: 20,
        }),
        ..Default::default()
    };
    let overlay = nas_picture_manager_axum::images::export_bytes(
        FIXTURE,
        &edits,
        nas_picture_manager_axum::images::ExportFormat::Png,
    )
    .unwrap();
    let (status, _, bytes) = post(
        "/api/images/export_overlay?rotation=1&cropX=1&cropY=2&cropWidth=10&cropHeight=20",
        annotated_body(FIXTURE, &overlay),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let output = nas_picture_manager_axum::images::read_bytes("output.png", &bytes).unwrap();
    assert_eq!((output.info.width, output.info.height), (10, 20));
    let (status, _, _) = post(
        "/api/images/export_overlay?rotation=1&cropX=1&cropY=2&cropWidth=10&cropHeight=20",
        annotated_body(FIXTURE, FIXTURE),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
}
