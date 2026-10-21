use crate::images::{CropRectangle, ImageError};
use image::DynamicImage;

pub(super) fn crop(
    source: DynamicImage,
    bounds: CropRectangle,
) -> Result<DynamicImage, ImageError> {
    validate_bounds(bounds, source.width(), source.height())?;
    if bounds.x == 0
        && bounds.y == 0
        && bounds.width == source.width()
        && bounds.height == source.height()
    {
        return Ok(source);
    }
    Ok(source.crop_imm(bounds.x, bounds.y, bounds.width, bounds.height))
}

pub(super) fn validate_bounds(
    bounds: CropRectangle,
    width: u32,
    height: u32,
) -> Result<(), ImageError> {
    if bounds.width == 0
        || bounds.height == 0
        || bounds
            .x
            .checked_add(bounds.width)
            .is_none_or(|right| right > width)
        || bounds
            .y
            .checked_add(bounds.height)
            .is_none_or(|bottom| bottom > height)
    {
        return Err(ImageError::InvalidEdits);
    }
    Ok(())
}
