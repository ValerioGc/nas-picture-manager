use super::{ImageEdits, ImageError};

/// Maximum allowed file size for image files in bytes.
pub const MAX_FILE_BYTES: usize = 30 * 1024 * 1024;

/// Supported file extensions for image files.
pub const EXTENSIONS: &[&str] = &[
    "png", "jpg", "jpeg", "webp", "gif", "bmp", "tif", "tiff", "ico",
];

/**
 * Validates the name of an image file.
 *
 * **Arguments**
 *
 * * `name` - The name of the image file to validate.
 *
 * **Returns**
 *
 * A `Result` indicating whether the name is valid. Returns `Ok(())` if valid,
 * or an `ImageError::InvalidInput` if the name is empty, too long, or contains invalid characters.
 */
pub fn validate_name(name: &str) -> Result<(), ImageError> {
    if name.is_empty()
        || name.len() > 255
        || name == "."
        || name == ".."
        || name
            .chars()
            .any(|c| c.is_control() || c == '/' || c == '\\')
    {
        return Err(ImageError::InvalidInput);
    }
    Ok(())
}

/**
 * Validates the edits applied to an image.
 *
 * **Arguments**
 *
 * * `edits` - A reference to the `ImageEdits` struct containing the edits to validate.
 *
 * **Returns**
 *
 * A `Result` indicating whether the edits are valid. Returns `Ok(())` if valid,
 * or an `ImageError::InvalidEdits` if any edit is out of the allowed range.
 */
pub fn validate_edits(edits: &ImageEdits) -> Result<(), ImageError> {
    if edits.rotation > 3
        || !(-100..=100).contains(&edits.brightness)
        || !(-100..=100).contains(&edits.contrast)
        || edits.sharpness > 100
    {
        return Err(ImageError::InvalidEdits);
    }
    if edits
        .crop
        .is_some_and(|crop| crop.width == 0 || crop.height == 0)
    {
        return Err(ImageError::InvalidEdits);
    }
    Ok(())
}
