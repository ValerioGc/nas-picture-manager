use serde::Serialize;

/// Represents the possible errors that can occur when working with images.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ImageError {
    InvalidInput,
    FileTooLarge,
    PixelLimitExceeded,
    DimensionLimitExceeded,
    DecodeMemoryLimitExceeded,
    TooManyFiles,
    UnsupportedFormat,
    InvalidImage,
    Unavailable,
    Busy,
    InvalidEdits,
    SaveFailed,
    OverwriteOriginal,
}

pub(crate) fn map_decode_error(error: image::ImageError) -> ImageError {
    match error {
        image::ImageError::Limits(error) => match error.kind() {
            image::error::LimitErrorKind::DimensionError => ImageError::DimensionLimitExceeded,
            image::error::LimitErrorKind::InsufficientMemory => {
                ImageError::DecodeMemoryLimitExceeded
            }
            _ => ImageError::InvalidImage,
        },
        _ => ImageError::InvalidImage,
    }
}
