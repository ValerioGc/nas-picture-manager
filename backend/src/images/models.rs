use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
/// Information about an image file.
pub struct ImageInfo {
    pub name: String,
    pub folder: Option<String>,
    pub width: u32,
    pub height: u32,
    pub format: String,
    pub has_alpha: bool,
    pub size: usize,
    pub created: Option<u64>,
    pub modified: Option<u64>,
}

/// A document containing image information and its preview.
#[derive(Debug, Serialize)]
pub struct ImageDocument {
    pub info: ImageInfo,
    pub preview: Vec<u8>,
}

impl ImageDocument {
    /// Transport envelope: little-endian JSON length, UTF-8 metadata, then raw PNG bytes.
    pub fn into_binary(self, metadata: &[u8]) -> Result<Vec<u8>, super::ImageError> {
        let length = u32::try_from(metadata.len()).map_err(|_| super::ImageError::Unavailable)?;
        let mut bytes = Vec::with_capacity(4 + metadata.len() + self.preview.len());
        bytes.extend_from_slice(&length.to_le_bytes());
        bytes.extend_from_slice(metadata);
        bytes.extend_from_slice(&self.preview);
        Ok(bytes)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CropRectangle {
    pub x: u32,
    pub y: u32,
    pub width: u32,
    pub height: u32,
}

/// Represents the edits that can be applied to an image.
#[derive(Debug, Default, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase", deny_unknown_fields)]
pub struct ImageEdits {
    pub rotation: u8,
    pub flip_horizontal: bool,
    pub flip_vertical: bool,
    pub brightness: i16,
    pub contrast: i16,
    pub sharpness: u8,
    pub crop: Option<CropRectangle>,
}

/**
 * ### Returns the file extension associated with the export format.
 *
 * **Returns**
 *
 * A string slice representing the file extension (e.g., "png", "jpg", "webp").
 */
#[derive(Debug, Default, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ExportFormat {
    #[default]
    Png,
    Jpeg,
    Webp,
    Gif,
    Bmp,
    Tiff,
    Ico,
}
impl ExportFormat {
    pub fn extension(self) -> &'static str {
        match self {
            Self::Png => "png",
            Self::Jpeg => "jpg",
            Self::Webp => "webp",
            Self::Gif => "gif",
            Self::Bmp => "bmp",
            Self::Tiff => "tiff",
            Self::Ico => "ico",
        }
    }
    pub fn mime_type(self) -> &'static str {
        match self {
            Self::Png => "image/png",
            Self::Jpeg => "image/jpeg",
            Self::Webp => "image/webp",
            Self::Gif => "image/gif",
            Self::Bmp => "image/bmp",
            Self::Tiff => "image/tiff",
            Self::Ico => "image/x-icon",
        }
    }
}
