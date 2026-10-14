use crate::images::{validate_edits, CropRectangle, ExportFormat, ImageEdits, ImageError};
use serde::Deserialize;

/// Flat query parameters keep image uploads binary and avoid expanding them into JSON arrays.
#[derive(Default, Deserialize)]
#[serde(default, rename_all = "camelCase", deny_unknown_fields)]
pub(super) struct EditQuery {
    rotation: u8,
    flip_horizontal: bool,
    flip_vertical: bool,
    brightness: i16,
    contrast: i16,
    sharpness: u8,
    crop_x: Option<u32>,
    crop_y: Option<u32>,
    crop_width: Option<u32>,
    crop_height: Option<u32>,
    pub format: ExportFormat,
}
impl EditQuery {
    pub fn edits(&self) -> Result<ImageEdits, ImageError> {
        let crop = match (self.crop_x, self.crop_y, self.crop_width, self.crop_height) {
            (None, None, None, None) => None,
            (Some(x), Some(y), Some(width), Some(height)) => Some(CropRectangle {
                x,
                y,
                width,
                height,
            }),
            _ => return Err(ImageError::InvalidEdits),
        };
        let edits = ImageEdits {
            rotation: self.rotation,
            flip_horizontal: self.flip_horizontal,
            flip_vertical: self.flip_vertical,
            brightness: self.brightness,
            contrast: self.contrast,
            sharpness: self.sharpness,
            crop,
        };
        validate_edits(&edits)?;
        Ok(edits)
    }
}
