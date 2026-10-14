use crate::images::ImageError;
use axum::{
    extract::rejection::BytesRejection,
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::Serialize;

#[derive(Serialize)]
struct ErrorBody {
    error: ImageError,
}

pub(super) struct ImageApiError(pub ImageError);

impl From<ImageError> for ImageApiError {
    fn from(error: ImageError) -> Self {
        Self(error)
    }
}

impl From<BytesRejection> for ImageApiError {
    fn from(error: BytesRejection) -> Self {
        Self(if error.status() == StatusCode::PAYLOAD_TOO_LARGE {
            ImageError::FileTooLarge
        } else {
            ImageError::InvalidInput
        })
    }
}

/// Convert an `ImageApiError` into an HTTP response with appropriate status code and JSON body.
impl IntoResponse for ImageApiError {
    fn into_response(self) -> Response {
        let status = match self.0 {
            ImageError::FileTooLarge
            | ImageError::PixelLimitExceeded
            | ImageError::DimensionLimitExceeded
            | ImageError::DecodeMemoryLimitExceeded
            | ImageError::TooManyFiles => StatusCode::PAYLOAD_TOO_LARGE,
            ImageError::Unavailable | ImageError::SaveFailed | ImageError::Busy => {
                StatusCode::SERVICE_UNAVAILABLE
            }
            _ => StatusCode::BAD_REQUEST,
        };
        (status, Json(ErrorBody { error: self.0 })).into_response()
    }
}
