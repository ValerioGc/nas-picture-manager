use super::sharpen::sharpen;
use crate::images::ImageEdits;
use image::DynamicImage;

/// Apply brightness and contrast in one pass, then sharpness, preserving alpha.
pub(super) fn apply_adjustments(source: DynamicImage, edits: &ImageEdits) -> DynamicImage {
    if edits.brightness == 0 && edits.contrast == 0 && edits.sharpness == 0 {
        return source;
    }
    let contrast = (1.0 + f32::from(edits.contrast) / 100.0).powi(2);
    let brightness = f32::from(edits.brightness) * 2.55;
    let lookup: [u8; 256] = std::array::from_fn(|value| {
        ((value as f32 - 127.5) * contrast + 127.5 + brightness)
            .round()
            .clamp(0.0, 255.0) as u8
    });
    let source = match source {
        DynamicImage::ImageRgb8(mut pixels) if edits.sharpness == 0 => {
            for channel in pixels.as_mut() {
                *channel = lookup[usize::from(*channel)];
            }
            return DynamicImage::ImageRgb8(pixels);
        }
        source => source,
    };
    let mut pixels = source.into_rgba8();
    if edits.brightness != 0 || edits.contrast != 0 {
        for pixel in pixels.pixels_mut() {
            for channel in &mut pixel.0[..3] {
                *channel = lookup[usize::from(*channel)];
            }
        }
    }
    sharpen(&mut pixels, edits.sharpness);
    DynamicImage::ImageRgba8(pixels)
}
