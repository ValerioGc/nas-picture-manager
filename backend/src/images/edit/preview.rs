use super::geometry::{apply_geometry, source_crop_bounds};
use crate::images::{
    viewer::encoding::{DecodedImage, MAX_PREVIEW_EDGE},
    CropRectangle, ImageEdits, ImageError,
};
use image::{imageops, DynamicImage};

/// Crop a borrowed source view, then transform only the bounded preview buffer.
pub(super) fn geometry_preview(
    source: &DecodedImage,
    edits: &ImageEdits,
) -> Result<(DynamicImage, u32, u32), ImageError> {
    let image = source.image.as_ref();
    let (width, height) = if edits.rotation % 2 == 1 {
        (image.height(), image.width())
    } else {
        (image.width(), image.height())
    };
    let (preview, output_width, output_height) = if let Some(bounds) = edits.crop {
        let original_bounds = source_crop_bounds(bounds, image.width(), image.height(), edits)?;
        (
            crop_preview(image, original_bounds)?,
            bounds.width,
            bounds.height,
        )
    } else {
        (source.preview().clone(), width, height)
    };
    let geometry = ImageEdits {
        crop: None,
        ..edits.clone()
    };
    Ok((
        apply_geometry(preview, &geometry)?,
        output_width,
        output_height,
    ))
}

fn crop_preview(image: &DynamicImage, bounds: CropRectangle) -> Result<DynamicImage, ImageError> {
    let scale = (f64::from(MAX_PREVIEW_EDGE) / f64::from(bounds.width.max(bounds.height))).min(1.0);
    let width = (f64::from(bounds.width) * scale).round().max(1.0) as u32;
    let height = (f64::from(bounds.height) * scale).round().max(1.0) as u32;
    macro_rules! cropped {
        ($pixels:expr, $variant:ident) => {{
            let view = imageops::crop_imm($pixels, bounds.x, bounds.y, bounds.width, bounds.height);
            DynamicImage::$variant(imageops::thumbnail(&*view, width, height))
        }};
    }
    Ok(match image {
        DynamicImage::ImageLuma8(pixels) => cropped!(pixels, ImageLuma8),
        DynamicImage::ImageLumaA8(pixels) => cropped!(pixels, ImageLumaA8),
        DynamicImage::ImageRgb8(pixels) => cropped!(pixels, ImageRgb8),
        DynamicImage::ImageRgba8(pixels) => cropped!(pixels, ImageRgba8),
        DynamicImage::ImageLuma16(pixels) => cropped!(pixels, ImageLuma16),
        DynamicImage::ImageLumaA16(pixels) => cropped!(pixels, ImageLumaA16),
        DynamicImage::ImageRgb16(pixels) => cropped!(pixels, ImageRgb16),
        DynamicImage::ImageRgba16(pixels) => cropped!(pixels, ImageRgba16),
        DynamicImage::ImageRgb32F(pixels) => cropped!(pixels, ImageRgb32F),
        DynamicImage::ImageRgba32F(pixels) => cropped!(pixels, ImageRgba32F),
        _ => return Err(ImageError::UnsupportedFormat),
    })
}
