use super::{adjust::apply_adjustments, annotations::apply_annotations, geometry::apply_geometry};
use crate::images::{
    validation::validate_edits, DecodedImage, ExportFormat, ImageEdits, ImageError,
};
use image::{DynamicImage, GenericImageView, ImageFormat};
use std::io::Cursor;

/// Export a decoded image, reusing its full-resolution buffer when it is uniquely owned.
/// `transformed` marks an annotation layer already expressed in output coordinates.
pub fn export_decoded(
    source: DecodedImage,
    edits: &ImageEdits,
    format: ExportFormat,
    annotations: Option<&[u8]>,
    transformed: bool,
) -> Result<Vec<u8>, ImageError> {
    validate_edits(edits)?;
    export_image(source.into_image(), edits, format, annotations, transformed)
}

fn export_image(
    source: DynamicImage,
    edits: &ImageEdits,
    format: ExportFormat,
    annotations: Option<&[u8]>,
    transformed: bool,
) -> Result<Vec<u8>, ImageError> {
    let original_dimensions = source.dimensions();
    let source = apply_adjustments(apply_geometry(source, edits)?, edits);
    let source = match annotations {
        Some(bytes) => apply_annotations(source, original_dimensions, bytes, edits, transformed)?,
        None => source,
    };
    encode(&source, format)
}

pub(crate) fn encode(decoded: &DynamicImage, format: ExportFormat) -> Result<Vec<u8>, ImageError> {
    let mut output = Cursor::new(Vec::new());
    match format {
        ExportFormat::Png => decoded.write_to(&mut output, ImageFormat::Png),

        ExportFormat::Webp => match decoded {
            DynamicImage::ImageRgb8(_) | DynamicImage::ImageRgba8(_) => {
                decoded.write_to(&mut output, ImageFormat::WebP)
            }
            _ => DynamicImage::ImageRgba8(decoded.to_rgba8())
                .write_to(&mut output, ImageFormat::WebP),
        },

        ExportFormat::Gif => decoded.write_to(&mut output, ImageFormat::Gif),
        ExportFormat::Bmp => decoded.write_to(&mut output, ImageFormat::Bmp),
        ExportFormat::Tiff => decoded.write_to(&mut output, ImageFormat::Tiff),
        ExportFormat::Ico => decoded.write_to(&mut output, ImageFormat::Ico),

        ExportFormat::Jpeg => {
            // JPEG has no alpha channel, so transparent pixels are blended over white.
            let rgb = image::RgbImage::from_fn(decoded.width(), decoded.height(), |x, y| {
                let pixel = decoded.get_pixel(x, y);
                let alpha = u32::from(pixel[3]);
                image::Rgb([0, 1, 2].map(|channel| {
                    ((u32::from(pixel[channel]) * alpha + 255 * (255 - alpha) + 127) / 255) as u8
                }))
            });
            image::codecs::jpeg::JpegEncoder::new_with_quality(&mut output, 92).encode_image(&rgb)
        }
    }
    .map_err(|_| ImageError::SaveFailed)?;

    Ok(output.into_inner())
}
