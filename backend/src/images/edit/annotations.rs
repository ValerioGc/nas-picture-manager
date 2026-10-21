use super::geometry::apply_geometry;
use crate::images::{
    viewer::decode::decode_with_dimensions, ImageEdits, ImageError, MAX_FILE_BYTES,
};
use image::{imageops::overlay, DynamicImage, GenericImageView, ImageFormat, Pixel};

pub(super) fn apply_annotations(
    source: DynamicImage,
    original_dimensions: (u32, u32),
    bytes: &[u8],
    edits: &ImageEdits,
    transformed: bool,
) -> Result<DynamicImage, ImageError> {
    if bytes.len() > MAX_FILE_BYTES {
        return Err(ImageError::FileTooLarge);
    }
    if bytes.is_empty() {
        return Err(ImageError::InvalidImage);
    }
    if image::guess_format(bytes).map_err(|_| ImageError::UnsupportedFormat)? != ImageFormat::Png {
        return Err(ImageError::InvalidEdits);
    }

    let mut source = match source {
        DynamicImage::ImageRgb8(_) | DynamicImage::ImageRgba8(_) => source,
        source => DynamicImage::ImageRgba8(source.into_rgba8()),
    };
    let expected = if transformed {
        source.dimensions()
    } else {
        original_dimensions
    };
    let (annotations, format) = decode_with_dimensions(bytes, Some(expected))?;
    if format != ImageFormat::Png || annotations.dimensions() != expected {
        return Err(ImageError::InvalidEdits);
    }
    let annotations = if transformed {
        annotations
    } else {
        apply_geometry(annotations, edits)?
    }
    .into_rgba8();
    match &mut source {
        DynamicImage::ImageRgb8(pixels) => {
            for (pixel, top) in pixels.pixels_mut().zip(annotations.pixels()) {
                let mut bottom = pixel.to_rgba();
                bottom.blend(top);
                *pixel = bottom.to_rgb();
            }
        }
        DynamicImage::ImageRgba8(pixels) => overlay(pixels, &annotations, 0, 0),
        _ => return Err(ImageError::InvalidEdits),
    }
    Ok(source)
}
