use crate::images::{error::map_decode_error, ImageError, MAX_FILE_BYTES};
use image::{DynamicImage, ImageDecoder, ImageFormat, ImageReader, Limits};
use std::io::Cursor;

const MAX_IMAGE_PIXELS: u64 = 100_000_000;
const MAX_IMAGE_EDGE: u32 = 16_384;
const MAX_DECODE_BYTES: u64 = 512 * 1024 * 1024;

/// Decode the accepted formats within fixed limits of size, pixels and memory.
pub(crate) fn decode(bytes: &[u8]) -> Result<(DynamicImage, ImageFormat), ImageError> {
    decode_with_dimensions(bytes, None)
}

pub(crate) fn decode_with_dimensions(
    bytes: &[u8],
    expected: Option<(u32, u32)>,
) -> Result<(DynamicImage, ImageFormat), ImageError> {
    if bytes.is_empty() {
        return Err(ImageError::InvalidImage);
    }
    if bytes.len() > MAX_FILE_BYTES {
        return Err(ImageError::FileTooLarge);
    }

    let mut reader = ImageReader::new(Cursor::new(bytes))
        .with_guessed_format()
        .map_err(|_| ImageError::InvalidImage)?;
    let format = reader.format().ok_or(ImageError::UnsupportedFormat)?;
    if !matches!(
        format,
        ImageFormat::Png
            | ImageFormat::Jpeg
            | ImageFormat::WebP
            | ImageFormat::Gif
            | ImageFormat::Bmp
            | ImageFormat::Tiff
            | ImageFormat::Ico
    ) {
        return Err(ImageError::UnsupportedFormat);
    }
    if format == ImageFormat::WebP {
        super::webp::validate_container(bytes)?;
    }
    let mut limits = Limits::default();
    limits.max_image_width = Some(MAX_IMAGE_EDGE);
    limits.max_image_height = Some(MAX_IMAGE_EDGE);
    limits.max_alloc = Some(MAX_DECODE_BYTES);
    reader.limits(limits);

    let mut decoder = reader.into_decoder().map_err(map_decode_error)?;
    let (width, height) = decoder.dimensions();
    if expected.is_some_and(|dimensions| dimensions != (width, height)) {
        return Err(ImageError::InvalidEdits);
    }
    if u64::from(width) * u64::from(height) > MAX_IMAGE_PIXELS {
        return Err(ImageError::PixelLimitExceeded);
    }
    if decoder.total_bytes() > MAX_DECODE_BYTES {
        return Err(ImageError::DecodeMemoryLimitExceeded);
    }

    let orientation = decoder.orientation().map_err(map_decode_error)?;
    let mut decoded = image::DynamicImage::from_decoder(decoder).map_err(map_decode_error)?;
    decoded.apply_orientation(orientation);

    Ok((decoded, format))
}
