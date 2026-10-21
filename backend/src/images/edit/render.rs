use super::{adjust::apply_adjustments, preview::geometry_preview};
use crate::images::{
    validation::validate_edits,
    viewer::encoding::{document_from_preview, image_info, DecodedImage},
    ImageDocument, ImageEdits, ImageError,
};

/// Render the bounded preview of a decoded image with the given edits.
pub fn render_decoded(
    source: &DecodedImage,
    edits: &ImageEdits,
) -> Result<ImageDocument, ImageError> {
    validate_edits(edits)?;
    let (preview, width, height) = geometry_preview(source, edits)?;
    let mut info = image_info(
        &source.name,
        source.size,
        source.image.as_ref(),
        source.format,
    );
    info.width = width;
    info.height = height;
    let preview = apply_adjustments(preview, edits);
    document_from_preview(info, &preview)
}
