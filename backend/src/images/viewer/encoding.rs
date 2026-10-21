use super::decode::decode;
use crate::images::{
    edit::convert::encode, validation::validate_name, ExportFormat, ImageDocument, ImageError,
    ImageInfo,
};
use image::{DynamicImage, ImageFormat};
use std::sync::{Arc, OnceLock};

pub(crate) const MAX_PREVIEW_EDGE: u32 = 2048;

#[derive(Clone)]
pub struct DecodedImage {
    pub(crate) name: String,
    pub(crate) size: usize,
    pub(crate) format: ImageFormat,
    pub(crate) image: Arc<DynamicImage>,
    preview: Arc<OnceLock<DynamicImage>>,
}

impl DecodedImage {
    pub(crate) fn into_image(self) -> DynamicImage {
        Arc::unwrap_or_clone(self.image)
    }
    pub(crate) fn preview(&self) -> &DynamicImage {
        self.preview.get_or_init(|| preview(self.image.as_ref()))
    }

    pub fn memory_bytes(&self) -> usize {
        self.image.as_bytes().len()
    }
}

pub fn decode_bytes(name: &str, bytes: &[u8]) -> Result<DecodedImage, ImageError> {
    validate_name(name)?;
    let (image, format) = decode(bytes)?;
    Ok(DecodedImage {
        name: name.to_owned(),
        size: bytes.len(),
        format,
        image: Arc::new(image),
        preview: Arc::new(OnceLock::new()),
    })
}

pub(crate) fn image_info(
    name: &str,
    size: usize,
    decoded: &DynamicImage,
    format: ImageFormat,
) -> ImageInfo {
    ImageInfo {
        name: name.to_owned(),
        folder: None,
        width: decoded.width(),
        height: decoded.height(),
        format: format.extensions_str()[0].to_uppercase(),
        has_alpha: decoded.color().has_alpha(),
        size,
        created: None,
        modified: None,
    }
}

/// Downscale the image to fit the preview edge, keeping its aspect ratio.
pub(crate) fn preview(decoded: &DynamicImage) -> DynamicImage {
    if decoded.width() <= MAX_PREVIEW_EDGE && decoded.height() <= MAX_PREVIEW_EDGE {
        return decoded.clone();
    }
    decoded.thumbnail(MAX_PREVIEW_EDGE, MAX_PREVIEW_EDGE)
}

pub fn document_decoded(decoded: &DecodedImage) -> Result<ImageDocument, ImageError> {
    document_from_preview(
        image_info(
            &decoded.name,
            decoded.size,
            decoded.image.as_ref(),
            decoded.format,
        ),
        decoded.preview(),
    )
}

pub(crate) fn document_from_preview(
    info: ImageInfo,
    preview: &DynamicImage,
) -> Result<ImageDocument, ImageError> {
    Ok(ImageDocument {
        info,
        preview: encode(preview, ExportFormat::Png)?,
    })
}
