use super::work::{ImageBody, ImageWorker, WorkPermit};
use super::{error::ImageApiError, query::EditQuery};
use crate::images::{
    document_decoded, export_decoded, render_decoded, ImageDocument, ImageError, MAX_FILE_BYTES,
};
use axum::{
    body::Bytes,
    extract::{rejection::QueryRejection, Query, State},
    http::{header, HeaderMap},
    response::{IntoResponse, Response},
    Extension, Json,
};
use std::sync::Arc;

/// Decode an upload and return its metadata and preview.
pub(super) async fn inspect(
    State(worker): State<Arc<ImageWorker>>,
    Extension(permit): Extension<WorkPermit>,
    headers: HeaderMap,
    ImageBody(bytes): ImageBody,
) -> Result<Response, ImageApiError> {
    let document = tokio::task::spawn_blocking(move || {
        let _permit = permit;
        document_decoded(&worker.decode(bytes)?)
    })
    .await
    .map_err(|_| ImageError::Unavailable)??;
    document_response(document, &headers).await
}

/// Return the preview of an upload with the requested edits.
pub(super) async fn render(
    State(worker): State<Arc<ImageWorker>>,
    Extension(permit): Extension<WorkPermit>,
    headers: HeaderMap,
    query: Result<Query<EditQuery>, QueryRejection>,
    ImageBody(bytes): ImageBody,
) -> Result<Response, ImageApiError> {
    let query = query.map_err(|_| ImageError::InvalidEdits)?.0;
    let edits = query.edits()?;
    let document = tokio::task::spawn_blocking(move || {
        let _permit = permit;
        render_decoded(&worker.decode(bytes)?, &edits)
    })
    .await
    .map_err(|_| ImageError::Unavailable)??;
    document_response(document, &headers).await
}

async fn document_response(
    document: ImageDocument,
    headers: &HeaderMap,
) -> Result<Response, ImageApiError> {
    let binary = headers
        .get(header::ACCEPT)
        .is_some_and(|value| value == "application/vnd.picture-manager.image");
    let mut response = if binary {
        let metadata = axum::body::to_bytes(Json(&document.info).into_response().into_body(), 8192)
            .await
            .map_err(|_| ImageError::Unavailable)?;
        (
            [(
                header::CONTENT_TYPE,
                "application/vnd.picture-manager.image",
            )],
            document.into_binary(&metadata)?,
        )
            .into_response()
    } else {
        Json(document).into_response()
    };
    response.headers_mut().insert(
        header::CACHE_CONTROL,
        "no-store".parse().map_err(|_| ImageError::Unavailable)?,
    );
    response.headers_mut().insert(
        header::X_CONTENT_TYPE_OPTIONS,
        "nosniff".parse().map_err(|_| ImageError::Unavailable)?,
    );
    response.headers_mut().insert(
        header::VARY,
        "Accept".parse().map_err(|_| ImageError::Unavailable)?,
    );
    Ok(response)
}

/// Return the full resolution export of an upload in the requested format.
pub(super) async fn export(
    State(worker): State<Arc<ImageWorker>>,
    Extension(permit): Extension<WorkPermit>,
    query: Result<Query<EditQuery>, QueryRejection>,
    ImageBody(bytes): ImageBody,
) -> Result<impl IntoResponse, ImageApiError> {
    let query = query.map_err(|_| ImageError::InvalidEdits)?.0;
    let edits = query.edits()?;
    export_response(bytes, edits, query.format, None, worker, permit, false).await
}

pub(super) async fn export_annotated(
    State(worker): State<Arc<ImageWorker>>,
    Extension(permit): Extension<WorkPermit>,
    query: Result<Query<EditQuery>, QueryRejection>,
    ImageBody(bytes): ImageBody,
) -> Result<impl IntoResponse, ImageApiError> {
    export_annotation_body(query, bytes, worker, permit, false).await
}

pub(super) async fn export_overlay(
    State(worker): State<Arc<ImageWorker>>,
    Extension(permit): Extension<WorkPermit>,
    query: Result<Query<EditQuery>, QueryRejection>,
    ImageBody(bytes): ImageBody,
) -> Result<impl IntoResponse, ImageApiError> {
    export_annotation_body(query, bytes, worker, permit, true).await
}

/// Split the envelope into the original image and the PNG layer of the annotations.
async fn export_annotation_body(
    query: Result<Query<EditQuery>, QueryRejection>,
    bytes: Bytes,
    worker: Arc<ImageWorker>,
    permit: WorkPermit,
    transformed: bool,
) -> Result<impl IntoResponse, ImageApiError> {
    let query = query.map_err(|_| ImageError::InvalidEdits)?.0;
    let edits = query.edits()?;
    let header: [u8; 4] = bytes
        .get(..4)
        .ok_or(ImageError::InvalidInput)?
        .try_into()
        .map_err(|_| ImageError::InvalidInput)?;
    let length = u32::from_le_bytes(header) as usize;
    if length == 0 {
        return Err(ImageError::InvalidInput.into());
    }
    let boundary = 4_usize
        .checked_add(length)
        .ok_or(ImageError::InvalidInput)?;
    if boundary >= bytes.len() {
        return Err(ImageError::InvalidInput.into());
    }
    if length > MAX_FILE_BYTES || bytes.len() - boundary > MAX_FILE_BYTES {
        return Err(ImageError::FileTooLarge.into());
    }
    export_response(
        bytes.slice(4..boundary),
        edits,
        query.format,
        Some(bytes.slice(boundary..)),
        worker,
        permit,
        transformed,
    )
    .await
}

async fn export_response(
    bytes: Bytes,
    edits: crate::images::ImageEdits,
    format: crate::images::ExportFormat,
    annotations: Option<Bytes>,
    worker: Arc<ImageWorker>,
    permit: WorkPermit,
    transformed: bool,
) -> Result<impl IntoResponse, ImageApiError> {
    let result = tokio::task::spawn_blocking(move || {
        let _permit = permit;
        export_decoded(
            worker.take_decoded(bytes)?,
            &edits,
            format,
            annotations.as_deref(),
            transformed,
        )
    })
    .await
    .map_err(|_| ImageError::Unavailable)??;
    Ok((
        [
            (header::CONTENT_TYPE, format.mime_type()),
            (header::CACHE_CONTROL, "no-store"),
            (header::X_CONTENT_TYPE_OPTIONS, "nosniff"),
        ],
        result,
    ))
}
