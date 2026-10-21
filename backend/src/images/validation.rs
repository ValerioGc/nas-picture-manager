use super::{ImageEdits, ImageError};

pub const MAX_FILE_BYTES: usize = 30 * 1024 * 1024;

/// Accept a plain file name with no path separators or control characters.
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
