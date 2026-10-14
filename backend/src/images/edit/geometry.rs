use super::{
    crop::{crop, validate_bounds},
    flip::flip,
    rotate::rotate,
};
use crate::images::{CropRectangle, ImageEdits, ImageError};
use image::DynamicImage;

pub(super) fn apply_geometry(
    source: DynamicImage,
    edits: &ImageEdits,
) -> Result<DynamicImage, ImageError> {
    let source = match edits.crop {
        Some(bounds) => {
            let original_bounds =
                source_crop_bounds(bounds, source.width(), source.height(), edits)?;
            crop(source, original_bounds)?
        }
        None => source,
    };
    let source = rotate(source, edits.rotation);
    let source = flip(source, edits.flip_horizontal, edits.flip_vertical);
    Ok(source)
}

pub(super) fn source_crop_bounds(
    bounds: CropRectangle,
    width: u32,
    height: u32,
    edits: &ImageEdits,
) -> Result<CropRectangle, ImageError> {
    let (rotated_width, rotated_height) = if edits.rotation % 2 == 1 {
        (height, width)
    } else {
        (width, height)
    };
    validate_bounds(bounds, rotated_width, rotated_height)?;
    let x = if edits.flip_horizontal {
        rotated_width - bounds.x - bounds.width
    } else {
        bounds.x
    };
    let y = if edits.flip_vertical {
        rotated_height - bounds.y - bounds.height
    } else {
        bounds.y
    };
    let (x, y, width, height) = match edits.rotation {
        1 => (y, height - x - bounds.width, bounds.height, bounds.width),
        2 => (
            width - x - bounds.width,
            height - y - bounds.height,
            bounds.width,
            bounds.height,
        ),
        3 => (width - y - bounds.height, x, bounds.height, bounds.width),
        _ => (x, y, bounds.width, bounds.height),
    };
    Ok(CropRectangle {
        x,
        y,
        width,
        height,
    })
}
